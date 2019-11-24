let express = require('express');
let http = require('http');
const cron = require('node-cron');
const SMA = require('technicalindicators').SMA;

const ForgeClient = require("forex-quotes");
let client = new ForgeClient.default('uD3ghInLCfnn7gsSKAwV3D1nnp1X55x8');

let app = express();
let server = http.createServer(app);
let ip = '127.0.0.1';
let port = 3000;
app.locals.priceValues = {
    EURUSD: [1.10201, 1.10202, 1.10203, 1.10204]
};
let triggerLimit = 2;
let triggerPrice = 1.10208;

app.get('/', function (req, res) {
    res.end('running cron job for price alert')
});

server.listen(port, ip, function () {
    console.log(`Server running at ${ip}:${port}`);
    cron.schedule('*/1 * * * * *', () => {
        normalFetchPrice();
    }).start();
});

// Optimize way is based on socket
function optimaizeFetchPrice() {
    // Handle incoming price updates from the server
    client.onUpdate((symbol, data) => {
        console.log(symbol, data);
    });

    // Handle non-price update messages
    client.onMessage((message) => {
        console.log(message);
    });

    // Handle disconnection from the server
    client.onDisconnect(() => {
        console.log("Disconnected from server");
    });
    // Handle successful connection
    client.onConnect(() => {

        // Subscribe to a single currency pair
        client.subscribeTo('EURUSD');

        // Subscribe to an array of currency pairs
        // client.subscribeTo([
        //     'GBPJPY',
        //     'AUDCAD',
        //     'EURCHF',
        // ]);

        // Subscribe to all currency pairs
        client.subscribeToAll();

        // Unsubscribe from a single currency pair
        // client.unsubscribeFrom('EURUSD');

        // Unsubscribe from an array of currency pairs
        // client.unsubscribeFrom([
        //     'GBPJPY',
        //     'AUDCAD',
        //     'EURCHF'
        // ]);

        // Unsubscribe from all currency pairs
        // client.unsubscribeFromAll();

        // Disconnect from the server
        client.disconnect();
    });

    client.connect();
}

// Normal way is based on api
function normalFetchPrice() {
    // Check if the market is open:
    client.getMarketStatus().then(response => {
        const { priceValues } = app.locals;

        if (!response.market_is_open) {
            // check if user have quota
            client.getQuota().then(response => {
                if (response.quota_remaining) {
                    client.getQuotes(['EURUSD']).then(response => {
                        for (var i in response) {
                            let res = response[i];

                            // create symbol object for store historical data
                            priceValues[res.symbol] = priceValues[res.symbol] ? priceValues[res.symbol] : [];
                            // auto clear old historical data
                            if (priceValues[res.symbol].length > 200) priceValues[res.symbol].shift();
                            // push new data
                            priceValues[res.symbol].push(res.price);
                            result = SMA.calculate({ period: 3, values: priceValues[res.symbol] });
                            // result = SMA.calculate({ period: 2, values: [1, 2, 3, 4, 5] });
                            // get new price of indicator
                            let newPrice = result.pop();
                            if (triggerLimit && (newPrice > triggerPrice || newPrice < triggerPrice)) {
                                console.log('SMA trigger price', newPrice,'Here you can send mail to user to notify');
                                triggerLimit--;
                            }
                        }
                    });
                } else {
                    console.error('You have exceeded the limit of your api');
                }
            });
        } else {
            console.error('Market is closed');
        }
    });
}