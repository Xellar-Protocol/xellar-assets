const fs = require('fs')
const axios = require('axios')

const downloadImage = (url, image_path) =>
    axios({
        url,
        responseType: 'stream',
    }).then(
        response =>
            new Promise((resolve, reject) => {
                response.data
                    .pipe(fs.createWriteStream(image_path))
                    .on('finish', () => resolve())
                    .on('error', e => reject(e));
            }),
    );


fs.readFile('./idlist.json', 'utf8', async function (err, data) {
    const obj = JSON.parse(data);
    let coinData = await axios.get(`https://api.coingecko.com/api/v3/coins/${obj[30]['id']}?tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`)
    let { id, name, symbol, description, links, image } = coinData.data;

    fs.promises.mkdir(`./assets/${id}`, { recursive: true })
    fs.writeFileSync(`./assets/${id}/info.json`, JSON.stringify({
        "name": name,
        "id": id,
        "symbol": symbol,
        "description": description.en.replace(/\s+/g, ' ').trim(),
        "links": links.homepage[0],
        "logo": `https://raw.githubusercontent.com/Xellar-Protocol/xellar-assets/master/assets/${id}/logo.png`
    }));
    downloadImage(image.large, `./assets/${id}/logo.png`)
});

