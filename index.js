const formidable = require('express-formidable');
const Express = require('express');
const app = Express();

const auth = require('./lib/auth');
const orders = require('./lib/orders');
const listings = require('./lib/listings');
let db = require('./database.json');

const port = process.env.PORT || 3000;

auth.checkJsonTables();

app.use(formidable());

app.set('view engine', 'ejs');
//html files without .html
app.use(Express.static("./public", {extensions: ['html']}));

app.get('/', (req, res) => {

    res.render('index', {list: db.listings});

});

app.post('/api/:part', (req, res) => {

    let prms = req.params;
    let query = req.query;
    let body = req.fields;

    switch (prms.part) {

        case "login":
            let authAttempt = auth.CheckPassword(body.username, body.password);
            if (authAttempt.ok == true) {
                res.cookie('username', body.username, {maxAge: 3600000});
                res.cookie('token', auth.getToken(body.username), {maxAge: 3600000});
                res.redirect(body.redirectUrl || '/me');
            } else {
                res.render('error', {HTTPstatus: 400, error: "bad request", message: authAttempt.reason});
            }
        break;

        case 'createuser':
            let userC = auth.NewUser(body.username, body.password);
            if (userC.ok == false) {
                res.status(400);
                res.render('error', {HTTPstatus: 400, error: "bad request", message: userC.error});
                return;
            }
            res.cookie('username', body.username, {maxAge: 3600000});
            res.cookie('token', auth.getToken(body.username), {maxAge: 3600000});
            res.redirect(body.redirectUrl || '/me');
        break;

        case "private_data":
            let unt = req.headers.authorization.split(':');
            if (auth.checkToken(unt[0], unt[1]).ok == true) {
                let user = auth.GetUser(unt[0]);
                let llistings = [];
                let lorders = [];
                let lho = [];
                user.selling.listings.forEach((listid) => {
                    let listing = db.listings[listid];
                    llistings.push(listing);
                });
                user.orders.forEach((orderid) => {
                    let order = db.orders[orderid];
                    lorders.push(order);
                });
                user.orderHistory.forEach((orderid) => {
                    let order = db.orders[orderid];
                    lho.push(order);
                });
                res.send({
                    user,
                    listings: llistings,
                    orders: lorders,
                    orderHistory: lho
                });
            } else {
                res.status(401);
                res.send("Unauthorized");
            }
        break;

        case 'becomeSeller':
            if(auth.CheckPassword(body.username, body.password).ok == false) {
                res.status(401);
                res.render('error', {HTTPstatus: 401, error: "Unauthorized", message: "Invalid password"});
                return;
            };
            auth.UpgradeToSeller(body.username, body.XMR);
            res.redirect('/me');
        break;

        case 'newListing':
            if(db.users[body.username] === undefined) {
                res.status(400);
                res.send("User does not exist");
                return;
            }
            if(body.quantity <= -2) {
                res.status(400);
                res.send("Invalid quantity, -1 = Unlimited and 0 and higher is a limited amount");
                return;
            }
            if(body.max_quantity <= -2) {
                res.status(400);
                res.send("Invalid max quantity, -1 = Unlimited and 0 and higher is a limited amount");
                return;
            }
            if(db.users[body.username].seller == false) {
                res.status(401);
                res.send("You are not a seller");
                return
            }
            if(auth.checkToken(body.username, body.token).ok == true) {
                let l = listings.newListing(body, body.username);
                res.redirect(`/l/${l.id}`);
            }
        break;

        case 'changeListing':
            if(auth.checkToken(body.username, body.token).ok == false) {
                res.status(401);
                res.send("Unauthorized -> " + auth.checkToken(body.username, body.token).reason);
                return;
            }
            if (auth.checkListingOwner(body.username, body.id).ok == false) {
                res.status(401);
                res.send("Unauthorized -> " + auth.checkListingOwner(body.username, body.listid).reason);
                return;
            }
            if(db.users[body.username] === undefined) {
                res.status(400);
                res.send("User does not exist");
                return;
            }
            if(db.users[body.username].seller == false) {
                res.status(401);
                res.send("You are not a seller");
                return
            }
            if(db.listings[body.id] === undefined) {
                res.status(400);
                res.send("Listing does not exist");
                return;
            }
            if(body.quantity <= -2) {
                res.status(400);
                res.send("Invalid quantity, -1 = Unlimited and 0 and higher is a limited amount");
                return;
            }
            if(body.max_quantity <= -2) {
                res.status(400);
                res.send("Invalid max quantity, -1 = Unlimited and 0 and higher is a limited amount");
            }
            listings.changeListing(body, body.username);
            res.redirect(`/l/${body.id}`);

        break;

        case 'deleteListing':
            if(auth.checkToken(body.username, body.token).ok == false) {
                res.status(401);
                res.send("Unauthorized -> " + auth.checkToken(body.username, body.token).reason);
                return;
            }
            if(db.users[body.username] === undefined) {
                res.status(400);
                res.send("User does not exist");
                return;
            }
            if(db.users[body.username].seller == false) {
                res.status(401);
                res.send("You are not a seller");
                return
            }
            if(db.listings[body.id] === undefined) {
                res.status(400);
                res.send("Listing does not exist");
                return;
            }
            if (auth.checkListingOwner(body.username, body.id).ok == false) {
                res.status(401);
                res.send("Unauthorized -> " + auth.checkListingOwner(body.username, body.listid).reason);
                return;
            }
            listings.deleteListing(body.id, body.username);
            res.redirect('/me');
        break;
        
        case 'placeOrder':
            
            if(!body.listing_id) {
                res.redirect('/me');
                return;
            }

            if (db.listings[body.listing_id] === undefined) {
                res.status(400);
                res.send("Listing does not exist");
                return;
            }
            
            if (!req.headers.cookie) {
                res.redirect(`/portal?redirectUrl=${escape(req.url)}`);
                return;
            }
            
            if (auth.checkToken(body.username, body.token).ok == false) {
                res.status(401);
                res.send("Unauthorized -> " + auth.checkToken(body.username, body.token).reason);
                return;
            }
            
            if (db.listings[body.listing_id].quantity == 0) {
                res.status(400);
                res.send("Listing is out of stock");
                return;
            }
            //check max quantity
            if(body.quantity > db.listings[body.listing_id].max_quantity && db.listings[body.listing_id].max_quantity != -1) {
                res.status(400);
                res.send("You cannot order more than the max quantity");
                return;
            }

            if (body.quantity <= 0) {
                res.status(400);
                res.send("Invalid quantity.");
                return;
            }

            //if quantity requested has decimal then it is invalid
            if (body.quantity % 1 != 0) {
                res.status(400);
                res.send("Invalid quantity.");
                return;
            }

            //if the listing owner is the same as the buyer, then we can't place an order
            if(db.listings[body.listing_id].owner == body.username) {
                res.status(400);
                res.send("You can't order your own listing");
                return;
            }

            let o = orders.newOrder(body);
            console.log(o);
            
            res.redirect('/order/'+o.id);
        break;

        case 'deleteaccount':
            if(body.certain != 'on') {
                res.render('error', {HTTPstatus: 400, error: "bad request", message: "You must confirm deletion"});
                return;
            }
            if(auth.checkToken(body.username, body.token).ok == false) {
                res.render('error', {HTTPstatus: 401, error: "Unauthorized", message: "You must be logged in to delete your account"});
                return;
            }
            auth.DeleteUser(body.username);
            res.render('error', {HTTPstatus: 200, error: "OK", message: "Account deleted"});
            break;

        default:
            res.status(404);
            res.send("<AUTH> 404");
        break;

    }

});

app.get('/order/:id', (req, res) => {
    if(!req.headers.cookie) {
        res.redirect('/portal');
        return
    }
    if(!req.query.token || !req.query.username) {
        res.render('auth/authReload');
        return
    }
    if (auth.checkToken(req.query.username, req.query.token).ok == false) {
        res.status(401);
        res.send("Unauthorized -> " + auth.checkToken(req.query.username, req.query.token).reason);
        return
    }
    if (auth.checkOrderAccess(req.query.username, req.params.id).ok == false) {
        res.status(401);
        res.send("Unauthorized -> " + auth.checkOrderAccess(req.query.username, req.params.id).reason);
        return
    }

    switch(req.query.action) {
        case 'cancel':
            orders.cancelOrder(req.params.id);
        break;

        case 'ship':
            if(req.query.username == db.orders[req.params.id].seller) {
                orders.shipOrder(req.params.id);
            } else {
                res.status(401);
                res.render('error', {HTTPstatus: 401, error: "Unauthorized", message: "You are not the seller."});
                return;
            }
        break;

        case 'complete':
            if(req.query.username == db.orders[req.params.id].buyer) {
            orders.closeOrder(req.params.id);
            } else {
                res.status(401);
                res.render('error', {HTTPstatus: 401, error: "Unauthorized", message: "You are not the buyer."});
                return
            }

        break;

    }
    res.render('custom/order', {username: req.query.username, token: req.query.token, id: req.params.id, order: db.orders[req.params.id], valuta: db.private.valuta, listing: db.listings[db.orders[req.params.id].listing]});

});

app.get('/l/:id', (req, res) => {
    if (!db.listings[req.params.id]) {
        res.status(404);
        res.send("<STORE> 404");
        return
    }
    if (req.query.action == "edit") {
        if(!req.headers.cookie) {
            res.redirect(`/portal?redirectUrl=${escape(req.url)}`);
            return
        }
        if(!req.query.token || !req.query.username) {
            res.render('auth/authReload');
            return
        }
        if (auth.checkToken(req.query.username, req.query.token).ok == false) {
            res.status(401);
            res.render('error', {HTTPstatus: 401, error: "Unauthorized", message: auth.checkToken(req.query.username, req.query.token).reason});
            return
        }
        if (auth.checkListingOwner(req.query.username, req.params.id).ok == false) {
            res.status(401);
            res.render('error', {HTTPstatus: 401, error: "Unauthorized", message: auth.checkListingOwner(req.query.username, req.params.id).reason});
            return
        }
        res.render('utilities/editListing', {username: req.query.username, token: req.query.token, id: req.params.id, valuta: db.private.valuta, listing: db.listings[req.params.id]});
        return
    }
    if (db.listings[req.params.id].owner == "[DELETED]") {
        res.status(404);
        res.send("<STORE> 404");
        return
    }

    res.render('custom/listing', {id: req.params.id, valuta: db.private.valuta, listing: db.listings[req.params.id], user: db.users[db.listings[req.params.id].owner]});
    
});

app.get('/profile/:username', (req, res) => {
 
    if (req.params.username == "my") {
        if(!req.query.username) {
            res.render('auth/authReload');
            return
        }
        res.redirect(`/profile/${req.query.username}`);
        return;
    }

    if (!db.users[req.params.username]) {
        res.status(404);
        res.send("<STORE> 404");
        return
    }

    res.render('custom/profile', {username: req.params.username, user: db.users[req.params.username], listings: db.listings});

});

app.get('/portal', (req, res) => {
    if(req.query.type === 'signup' || req.query.type === 'register') {
        res.render('auth/register', {redirectUrl: req.query.redirectUrl || '/me'});
        return;
    }
    res.render('auth/login', {redirectUrl: req.query.redirectUrl || '/me'});
});

app.get('/me', (req, res) => {

    if(!req.headers.cookie) {
        res.redirect('/portal');
    } else {
        if(req.query.action === 'logout') {
            res.clearCookie('username');
            res.clearCookie('token');
            res.redirect('/');
            return;
        }
        res.render('personal/me', {login_ok:false});
    }

});

app.get('/buy', (req, res) => {

    let q = req.query;
    if (!req.headers.cookie) {
        res.redirect(`/portal?redirectUrl=${escape(req.url)}`);
        return;
    }
    if (!q.token || !q.username) {
        res.render('auth/authReload');
        return;
    }
    if (q.id) {
        if (!db.listings[q.id]) { 
            res.status(404);
            res.send("<STORE> 404");
        }
        if (auth.checkToken(q.username, q.token).ok == false) {
            res.status(401);
            res.send("Unauthorized -> " + auth.checkToken(q.username, q.token).reason);
            return
        }
        let data = {
            id: q.id,
            valuta: db.private.valuta,
            listing: db.listings[q.id],
            username: q.username,
            token: q.token
        }
        if (data.listing.quantity == 0) {
            res.redirect('/l/' + q.id);
            return;
        }
        res.render('utilities/buy', data);
    } else {
        res.redirect('/');
    }

});

app.get('/becomeSeller', (req, res) => {

    if (!req.headers.cookie) {
        res.redirect('/portal');
    }
    res.render('personal/becomeSeller', {username: req.query.username});

});

app.get('/newListing', (req, res) => {

    if(!req.headers.cookie) {
        res.redirect('/portal');
        return
    }
    if(!req.query.token || !req.query.username) {
        res.render('auth/authReload');
        return
    }
    if (auth.checkToken(req.query.username, req.query.token).ok == false) {
        res.status(401);
        res.send(`Unauthorized.`);
        return
    }
    res.render('utilities/newListing', {valuta: db.private.valuta, username: req.query.username, token: req.query.token});


})

app.get('/deleteAccount', (req, res) => {

    if (!req.headers.cookie) {
        res.redirect(`/portal?redirectUrl=${escape(req.url)}`);
    }
    if(!req.query.token || !req.query.username) {
        res.render('auth/authReload');
        return
    }
    if (auth.checkToken(req.query.username, req.query.token).ok == false) {
        res.status(401);
        res.send(`Unauthorized.`);
        return
    }

    res.render('personal/deleteAccount', {username: req.query.username, token: req.query.token});

});

app.get('/admin', (req, res) => {
   
    if (!req.headers.cookie) {
        res.redirect('/portal');
    }

    if(!req.query.token || !req.query.username) {
        res.render('auth/authReload');
        return
    }
    
    if (auth.checkToken(req.query.username, req.query.token).ok == false) {
        res.status(401);
        res.send(`Unauthorized.`);
        return
    }

    if (db.users[req.query.username].admin == false) {
        res.status(401);
        res.send(`Unauthorized.`);
        return
    }

    let msg = "";

    switch(req.query.action) {
        case 'dropTables':
            let user = db.users[req.query.username];
            user.orders = [];
            user.orderHistory = [];
            user.selling.listings = [];

            delete db.users;
            delete db.listings;
            delete db.orders;

            db.users = {};
            db.listings = [];
            db.orders = [];

            db.users[req.query.username] = user;
            auth.sdb();

            msg = "Tables dropped.";
        break;
    }
    
    res.render('admin', {username: req.query.username, token: req.query.token, message: msg});

});

// THIS SHOULD BE THE LAST ROUTE!!!
app.all('*', (req, res) => {

    res.status(404);
    res.send("404, not found.");

})

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
