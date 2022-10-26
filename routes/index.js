let express = require('express');
let router = express.Router();
const bitcore = require('bitcore-lib');
const axios = require('axios');

const network = "BTCTEST";
const privateKey = "91eW17ijcxqhPzSgJGMc3k6x8ERL8WgyabUH4BDKRYcTWRhZQGA";
const publicAddress = "mr2pbWL6ZaK15hi3mLSpJ5cDHeMxwv8xxA";


router.get('/', async function(req, res) {
    res.render('index', {
        balance: await getBalance(publicAddress),
        error: req.flash('error'),
        success: req.flash('success'),
        address: publicAddress
    });
});

router.post('/', async function (req, res) {
    let btcAmount = req.body.amount;
    let address = req.body.address;

    if (btcAmount === undefined || btcAmount === "") {
        req.flash('error', "The amount to sent must be given.");
        res.redirect("/");
        return;
    }

    if (isNaN(btcAmount)) {
        req.flash('error', "The amount must be numeric.");
        res.redirect("/");
        return;
    }

    if (address === undefined || address === "") {
        req.flash('error', "The recipient address must be given.");
        res.redirect("/");
        return;
    }

    // TODO: Test if the given BTC address is valid for the given network ...
    if(!bitcore.Address.isValid(address, bitcore.Networks.testnet)) {
        req.flash("error", "invalid recipient address.");
        res.redirect("/");
        return;
    }

    try {
        const result = await sendBitcoin(address, btcAmount);
        console.log(result);
        req.flash('success', btcAmount + " BTC sent successfully to " + address
            + ". I may take up to few minutes before the transaction is completed.");
        res.redirect("/");
    } catch (e) {
        req.flash("error", e.message);
        res.redirect("/");
    }


});

async function getBalance(address) {
    // TODO: Retrieve the real BTC balance for a given address
    const url = `https://chain.so/api/v2/get_address_balance/${network}/${address}`;
    const result = await axios.get(url);
    const data = result.data.data;
    const confirmedBalance  = parseFloat(data.confirmed_balance);
    const unconfirmedBalance = parseFloat(data.unconfirmed_balance);
    return (confirmedBalance + unconfirmedBalance).toFixed(8);
}

async function sendBitcoin(toAddress, btcAmount) {
    // TODO: Proceed to do the real transfer ...
    const satoshiToSend = Math.ceil(btcAmount * 1e8);
    const txUrl = `https://chain.so/api/v2/get_tx_unspent/${network}/${publicAddress}`;
    const txResult = await axios.get(txUrl);

    let inputs = [];
    let totalAmountAvailable = 0;
    let inputCount = 0;

    for (const element of txResult.data.data.txs) {
        let utx = {};
        utx.satoshis = Math.floor(Number(element.value) * 1e8);
        utx.script = element.script_hex;
        utx.address = txResult.data.data.address;
        utx.txId = element.txid;
        utx.outputIndex = element.output_no;
        totalAmountAvailable +=  utx.satoshis;
        inputCount++;
        inputs.push(utx);
    }

    const transaction = new bitcore.Transaction();
    transaction.from(inputs);
    let outputCount = 2;
    let transactionSize = (inputCount * 148) + (outputCount * 34) + 10;
    let fee = transactionSize * 20;

    if (totalAmountAvailable - satoshiToSend - fee < 0) {
        throw new Error("criss de povre");
    }

    transaction.to(toAddress, satoshiToSend);
    transaction.fee(fee);
    transaction.change(publicAddress);

    transaction.sign(privateKey);
    const serializedTransaction = transaction.serialize();
    const result = await axios({
        method: "post",
        url: `https://chain.so/api/v2/send_tx/${network}`,
        data: {
            tx_hex: serializedTransaction
        }
    });
    return result.data.data
}

module.exports = router;
