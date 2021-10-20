let ck = document.cookie;

/* cookies to json */
let ck_json = {};
let ck_arr = ck.split('; ');
for (let i = 0; i < ck_arr.length; i++) {
    let ck_item = ck_arr[i].split('=');
    ck_json[ck_item[0]] = ck_item[1];
}

if(!ck_json.token) {
    location.href = '/portal';
} else {

    //if lastrequest was 5 seconds ago, refresh
    let lastrequest = window.localStorage.getItem('lastrequest');
    if(Date.now() - lastrequest > 5000) {
        refresh();
    } else {
        setPage();
    }

}

function cleanPage() {

    document.getElementById("item-list").innerHTML = "";
    document.getElementById("orders").innerHTML = "";
    document.getElementById("oh").innerHTML = "";
    document.getElementById("sellerdiv").classList.add('hide');
    document.getElementById("nosellerlinks").classList.add('hide');
    document.getElementById("sellerlinks").classList.add('hide');


}

function refresh() {

    console.log('refreshing');
        const xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function() {
            if (xhr.readyState == XMLHttpRequest.DONE) {
                //if error /me
                if(xhr.status != 200) {
                    console.log('error');
                    window.location.href = '/portal';
                    return
                }

                console.log(xhr.responseText);
                let dayta = JSON.parse(xhr.responseText);
                console.log(dayta);

                window.localStorage.setItem('data', xhr.responseText);
                window.localStorage.setItem('lastrequest', Date.now());
                setPage();
                
            }

        }
        
        xhr.open('POST', '/api/private_data');
        xhr.setRequestHeader('Authorization', ck_json.username + ":" + ck_json.token);
        xhr.send();

}

function setPage() {

    cleanPage();

    let dayta = JSON.parse(window.localStorage.getItem('data'));
    console.log(dayta);

    document.getElementById("main").innerHTML = `Welcome, ${ck_json.username}!`;

    if(dayta.user.seller == true) {
        document.getElementById('sellerlinks').classList.remove('hide');
        document.getElementById('sellerdiv').classList.remove('hide');
        document.getElementById("earnings").innerText = dayta.user.selling.statistics.earnings;
        document.getElementById("karma").innerText = dayta.user.selling.statistics.karma;
        document.getElementById("sold").innerText = dayta.user.selling.statistics.sold;

        dayta.listings.forEach(function(item, i) {

            /* [{"name": "this", "image": {"src": "/files/image.jpeg","href": "/files/image.jpeg"},"price": 1.2781, "quantity": 1, shipping_fee: 0.000276}] */

            let li = document.createElement('li');
            li.innerHTML = `<a href="/l/${item.id}">${item.name} | ${item.price}</a>`;
            document.getElementById("item-list").appendChild(li);

        });
    } else {
        document.getElementById('nosellerlinks').classList.remove('hide');
        document.getElementById('bas').href = `/becomeSeller?username=${ck_json.username}`;
    }
    dayta.orders.forEach(function(item, i) {
        let li = document.createElement('li');
        li.innerHTML = `<a href="/order/${item.id}">Order #${item.id} | ${item.name} | ${item.price}</a>`;
        document.getElementById("orders").appendChild(li);
    });
    dayta.orderHistory.forEach(function(item, i) {
        let li = document.createElement('li');
        li.innerHTML = `<a href="/order/${item.id}">Order #${item.id} | ${item.name} | ${item.price}</a>`;
        document.getElementById("oh").appendChild(li);
    });

}


document.getElementById('loadhis').onclick = function() {

    if(document.getElementById('oh').classList.contains('hide')) {
        document.getElementById('oh').classList.remove('hide');
    } else {
        document.getElementById('oh').classList.add('hide');
    }


}