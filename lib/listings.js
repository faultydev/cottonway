const db = require('../database.json');
const auth = require('./auth');
const fs = require('fs');

exports.newListing = function(q, username) {

    let user = db.users[username];

    let data = {
        id: db.listings.length,
        image: {
            src: q.image
        },
        name: q.name,
        price: Number(q.price),
        shipping_fee: Number(q.shipping_fee),
        owner: username,
        quantity: Number(q.quantity),
        max_quantity: Number(q.quantity),
        description: q.description,
        orders: [],
        created: new Date()
    }

    db.listings.push(data);
    db.users[q.username].selling.listings.push(data.id);
    saveDB();
    return data;

}

exports.changeListing = function(body, username) {

    let listing = db.listings[body.id];

    listing.image.src = body.image;
    listing.description = body.description;
    listing.price = Number(body.price);
    listing.shipping_fee = Number(body.shipping);
    listing.quantity = Number(body.quantity);
    listing.max_quantity = Number(body.max_quantity);

    saveDB();
    return listing;


}

exports.deleteListing = function(id, username) {
    let listing = db.listings[id];
    let user = db.users[username];

    listing.orders.forEach(function(orderid) {
        let order = db.orders[orderid];
        if (order.status == "pending") {
            order.status = "cancelled";
        } else if (order.status == "escrow_received") {
            order.status = "please contact an admin to get your funds back from an escrow.";
        } else if (order.status == "shipped") {
            order.status = "shipped & listing was deleted";
        } else if (order.status == "completed") {
            order.status = "completed & listing was deleted";
        } else {
            order.status = "cancelled";
        }

        let o_buy = db.users[order.buyer];
        let o_sell = db.users[order.seller];
        o_buy.orders.splice(o_buy.orders.indexOf(orderid), 1);
        o_sell.orders.splice(o_sell.orders.indexOf(orderid), 1);
        o_buy.orderHistory.push(Number(orderid));
        if(order.buyer != order.seller) o_sell.orderHistory.push(Number(orderid));

    });
    
    user.selling.listings.splice(user.selling.listings.indexOf(id), 1);

    db.listings[id] = 0;
    saveDB();
    return;

}

function saveDB() {
    fs.writeFileSync('./database.json', JSON.stringify(db));
}