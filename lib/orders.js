const db = require('../database.json');
const fs = require('fs');

exports.newOrder = function(q) {
    let order = {
        id: db.orders.length,
        name: db.listings[q.listing_id].name,
        buyer: q.username,
        seller: db.listings[q.listing_id].owner,
        valuta: db.private.valuta, listing: q.listing_id,
        quantity: Number(q.quantity),
        price: Number(db.listings[q.listing_id].price),
        shipping_address: {
            name: q.name,
            address: q.address,
            country: q.country,
            state: q.state,
            city: q.city,
            zip: q.zip,
        },
        use_middle_man: q.use_middle_man,
        shipping_fee: Number(db.listings[q.listing_id].shipping_fee),
        total: Number(db.listings[q.listing_id].price) * Number(q.quantity) + Number(db.listings[q.listing_id].shipping_fee),
        status: "pending",
        created: Date.now(),
        updated: Date.now()
    }
    db.orders.push(order);
    if (db.listings[q.listing_id].quantity != -1) db.listings[q.listing_id].quantity -= Number(q.quantity);
    db.listings[q.listing_id].orders.push(Number(order.id));
    db.users[order.buyer].orders.push(Number(order.id));
    db.users[order.seller].orders.push(Number(order.id));
    saveDB();
    return order;
}

exports.shipOrder = function(order_id) {
    let order = db.orders[order_id];
    if (order.status == "pending") {
        order.status = "shipped";
        order.updated = Date.now();
        saveDB();
        return order;
    }
}

exports.cancelOrder = function(order_id) {
    let order = db.orders[order_id];
    if (order.status == "pending") {
        order.status = "cancelled";
        // delete from buyers and seller's orders and add to order history
        db.users[order.buyer].orders.splice(db.users[order.buyer].orders.indexOf(order_id), 1);
        db.users[order.seller].orders.splice(db.users[order.seller].orders.indexOf(order_id), 1);
        db.users[order.buyer].orderHistory.push(order_id);
        if (order.buyer == order.seller) {
            saveDB();
            return
        };
        db.users[order.seller].orderHistory.push(order_id);
        if(db.listings[order.listing].quantity != -1 ) db.listings[order.listing].quantity += order.quantity;

        order.updated = Date.now();

        saveDB();
    }
    if (order.status == "cancelled") {
        if (db.users[order.buyer].orders.indexOf(order_id) != -1) {
            db.users[order.buyer].orders.splice(db.users[order.buyer].orders.indexOf(order_id), 1);
            if (db.users[order.buyer].orderHistory.indexOf(order_id) == -1) db.users[order.buyer].orderHistory.push(order_id);
        }
        if (db.users[order.seller].orders.indexOf(order_id) != -1) {
            db.users[order.seller].orders.splice(db.users[order.seller].orders.indexOf(order_id), 1);
            if (db.users[order.seller].orderHistory.indexOf(order_id) == -1) db.users[order.seller].orderHistory.push(order_id);
        }
    }
}

exports.closeOrder = function(order_id) {
    let order = db.orders[order_id];
    if (order.status == "pending") {
        order.status = "completed";
    } else if (order.status == "shipped") {
        order.status = "delivered";
    } else if (order.status == "cancelled") {
        return;
    }

    // delete from buyers and seller's orders and add to order history
    db.users[order.buyer].orders.splice(db.users[order.buyer].orders.indexOf(Number(order_id)), 1);
    db.users[order.seller].orders.splice(db.users[order.seller].orders.indexOf(Number(order_id)), 1);

    db.users[order.seller].selling.statistics.sold += 1;
    db.users[order.seller].selling.statistics.earnings += order.total;

    saveDB();
}

function saveDB() {
    fs.writeFileSync('./database.json', JSON.stringify(db));
}
