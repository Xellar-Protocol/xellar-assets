const fs = require('fs')
const axios = require('axios');
const { resolve } = require('path');

const downloadImage = async (url, image_path) => {
    return new Promise(async (resolve, reject) => {
        try {
            var response = await axios({
                url,
                responseType: 'stream',
            });
            response.data
                .pipe(fs.createWriteStream(image_path))
                .on('finish', () => resolve())
                .on('error', e => reject(e));
        } catch (e) {
            return reject()
        }
    })

}

const sleeps = async () => await new Promise(r => setTimeout(r, 5000));


fs.readFile('./idlist.json', 'utf8', async function (err, data) {
    const obj = JSON.parse(data);
    let count = 0;
    let queryParam = [];
    // for (var i = count; i < 100; i++) {
    //     queryParam.push(obj[i]['id'])
    // }
    var latest = JSON.parse(fs.readFileSync('./record.json', 'utf8'));
    for (var i = latest['latest_step'] ?? 0; i < obj.length; i++) {
        count++;
        let coinData;
        let tempError = [];
        console.log(obj[i]['id'])
        //CG
        try {
            coinData = await axios.get(`https://api.coingecko.com/api/v3/coins/${obj[i]['id']}?tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`)
        } catch (e) {
            tempError = latest['errorList'];
            tempError.push({
                "id": obj[i]['id']
            })
            console.log('missing coin / token data')
            continue;
        }
        let { id, name, symbol, description, links, image } = coinData.data;
        //CMC
        // let coinData = await axios.get(`https://pro-api.coinmarketcap.com/v2/cryptocurrency/info?id=${obj[i]['id']}`, { headers: { "X-CMC_PRO_API_KEY": "161bfd50-6175-4e3c-87cc-8202a5882e44" } })
        // let { data } = coinData.data;

        await fs.promises.mkdir(`./assets/${id}`, { recursive: true })
        fs.writeFileSync('./record.json', JSON.stringify({
            "latest_step": i,
            "errorList": tempError
        }))
        fs.writeFileSync(`./assets/${id}/info.json`, JSON.stringify({
            "name": name,
            "id": id,
            "symbol": symbol,
            "description": description.en.replace(/\s+/g, ' ').trim(),
            "links": links.homepage[0],
            "logo": `https://raw.githubusercontent.com/Xellar-Protocol/xellar-assets/master/assets/${id}/logo.png`
        }));
        try {
            await downloadImage(image.large, `./assets/${id}/logo.png`);
        } catch (e) {
            console.log('missing  image')
            await downloadImage("https://assets.coingecko.com/coins/images/1/large/bitcoin.png?1547033579", `./assets/${id}/logo.png`);
        }
        await sleeps()
        console.log('\x1b[33m%s\x1b[0m', `done -> ${i}/${obj.length}`);
    }


});

