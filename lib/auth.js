const crypto = require('crypto');
const fs = require('fs');
const db = require('../database.json');

exports.checkJsonTables = () =>{
    if (db.users === undefined) {
        db.users = {};
    }
    if (db.listings === undefined) {
        db.listings = [];
    }
    if (db.orders === undefined) {
        db.orders = [];
    }
    if (db.private === undefined) {
        db.private = {
            relayAdresses: [],
            bannedAdresses: [],
            bannedUsers: [],
            bannedTerms: [],
            valuta: "XMR"
        };
    }
    saveDB();
}

exports.GetUser = (username) => {
    if (db.users[username] === undefined) {
        return false;
    }
    return db.users[username];
}

exports.NewUser = (username, password) => {
    if (db.users[username] !== undefined) {
        return {ok: false, error: "Username already exists"};
    }
    if (username.length < 3 || username.length > 20) {
        return {ok: false, error: "Username must be between 3 and 20 characters"};
    }
    if (db.private.bannedUsers.includes(username)) {
        return {ok: false, error: "Username is banned"};
    }
    db.users[username] = {
        created: Date.now(),
        password: crypto.createHash('sha256').update(password).digest('hex'),
        lastLoginAttempt: 0,
        lastTokenAttempt: 0,
        token: crypto.randomBytes(32).toString('hex'),
        orders: [],
        orderHistory: [],
        buying: {
            sendingAddress: "",
            givenKarma: 0
        },
        selling: {
            listings: [],
            sellerProfile: {
                description: "",
                image: ""
            },
            statistics: {
                sold: 0,
                earnings: 0,
                karma: 0
            },
            receivingAddress: ""
        },
        seller: false,
        admin: false
    };
    saveDB();
    return {ok: true, error: ""};
}

exports.UpgradeToSeller = (username, receivingAddress) => {
    if (db.users[username] === undefined) {
        return false;
    }
    db.users[username].seller = true;
    db.users[username].selling.receivingAddress = receivingAddress;
    saveDB();
    return true;
}

exports.DeleteUser = (username) => {
    if (db.users[username] === undefined) {
        return false;
    }
    db.users[username].orders.forEach(orderId => {
        if(db.orders[orderId].buyer === username) {
            db.orders[orderId].buyer = "[deleted]";
        } else if (db.orders[orderId].seller === username) {
            db.orders[orderId].seller = "[deleted]";
        }
        db.orders[orderId].status = "cancelled";
    });
    db.users[username].orderHistory.forEach(orderId => {
        if(db.orders[orderId].buyer === username) {
            db.orders[orderId].buyer = "[deleted]";
        }
        if (db.orders[orderId].seller === username) {
            db.orders[orderId].seller = "[deleted]";
        }
        db.orders[orderId].status = "cancelled";
    });
    db.users[username].selling.listings.forEach(listingId => {
        db.listings[listingId] = 0;
    }); 
    delete db.users[username];
    saveDB();
    return true;
}

exports.CheckPassword = (username, password) => {
    if (db.users[username] === undefined) {
        return {ok: false, reason: "User does not exist"};
    }
    // if last login attempt was less then 15 seconds ago, return false
    if (db.users[username].lastLoginAttempt > Date.now() - 15000) {
        return {ok:false, reason:"too many login attempts"};
    }
    db.users[username].lastLoginAttempt = Date.now();
    if(db.users[username].password === crypto.createHash('sha256').update(password).digest('hex')) {
        return {ok: true, reason: ""};
    } else {
        return {ok: false, reason: "Wrong password"};
    }
}

exports.checkToken = (username, token) => {

    if (db.users[username] === undefined) {
        return {ok: false, reason: "User does not exist"};
    }
    // if last token attempt was less then a minute ago, return false
    if (db.users[username].lastTokenAttempt > Date.now() - 60000) {
        return {ok:false, reason:"too many token attempts"};
    }
    if(db.users[username].token === token) {
        return {ok: true, reason: ""};
    } else {
        db.users[username].lastTokenAttempt = Date.now();
        return {ok: false, reason: "Wrong token"};
    }
}

exports.checkOrderAccess = (username, orderId) => {

    if (db.users[username] === undefined) {
        return {ok: false, reason: "User does not exist"};
    }
    // check if seller or buyer is the user
    if (db.orders[orderId].seller == username) {
        return {ok: true, reason: ""};
    }
    if (db.orders[orderId].buyer == username) {
        return {ok: true, reason: ""};
    }

    // check if user is admin
    if (db.users[username].admin == true) {
        return {ok: true, reason: ""};
    }

    return {ok: false, reason: "User does not have access to this order"};

};

exports.checkListingOwner = (username, listingId) => {
    if(db.users[username] === undefined) {
        return {ok: false, reason: "User does not exist"};
    }
    if(db.listings[listingId] === undefined) {
        return {ok: false, reason: "Listing does not exist"};
    }
    if(db.listings[listingId].owner !== username) {
        return {ok: false, reason: "User does not own this listing"};
    }
    return {ok: true, reason: ""};
}

exports.getToken = (username) => {
    if (db.users[username] === undefined) {
        return false;
    }
    if (db.users[username].lastTokenAttempt > Date.now() - 60000) {
        return false;
    }
    return db.users[username].token;
}

function saveDB() {
    fs.writeFileSync('./database.json', JSON.stringify(db));
}

exports.sdb = saveDB;