const fs = require('fs')
const axios = require('axios');
const { resolve } = require('path');
const { isEmpty, _ } = require('lodash');



const exeptionList = [
    "ethereum",
]

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

const sleeps = async () => await new Promise(r => setTimeout(r, 5500));

const findNativeByID = (input) => {
    let nativeList = ['ethereum', 'binancecoin', 'matic-network', 'avalanche-2', 'fantom'];
    //'tomochain', 'harmony', 'moonbeam', 'moonriver', 'kucoin-shares', 'kava',
    return !isEmpty(nativeList.filter((x) => x == input))
}



const constructTokenList = ({
    fileName = 'tokenlist.json'
}) => {
    let constructJSON = [];
    const files = fs.readdirSync('./assets')
    for (var i = 0; i < files.length; i++) {
        try {
            var info = JSON.parse(fs.readFileSync(`./assets/${files[i]}/info.json`, 'utf8'));
            let isNative = findNativeByID(info.id)
            let tempNative = info.detail_platform['native'] ?? {};
            if (isNative) {
                info.detail_platform['native'] = [
                    tempNative
                ];
            }

            const isHaveNative = _.has(info.detail_platform, 'native')
            if (isHaveNative) {

                Object.keys(info.detail_platform).forEach(function (key, index) {
                    if (key != 'native') {
                        info.detail_platform[key] = {
                            ...info.detail_platform[key],
                            wrapped: true
                        }
                    }
                });

            }


            constructJSON.push({
                "id": info.id,
                "name": info.name,
                "symbol": info.symbol,
                "logo": info.logo,
                "is_native": isNative,
                "detail_platform": info.detail_platform
            })
            console.log('\x1b[33m%s\x1b[0m', `done ${files[i]} -> ${i}/${files.length}`);
        } catch (e) {
            console.log(e)
            continue;
        }
    }
    fs.writeFileSync(`./${fileName}`, JSON.stringify(constructJSON))
}




const fetchAllErrorTokenDetailData = async () => {
    // const files = fs.readdirSync('./assets')

    var latest = JSON.parse(fs.readFileSync('./record.json', 'utf8'));
    const files = latest['errorList']

    for (var i = latest['latest_step'] ?? 0; i < files.length; i++) {
        var record = JSON.parse(fs.readFileSync('./record.json', 'utf8'));
        let coinData;
        let tempError = record['errorList'];
        let tempNotFound = record['notFound'];
        try {
            coinData = await doFetch(files[i].id)
        } catch (e) {
            console.log(`missing coin / token data ${files[i].id}`)
            console.log(e)
            tempError = tempError.filter((x) => x.id != files[i].id);
            fs.rmSync(`./assets/${files[i].id}`, { force: true, recursive: true })
            tempError.push({
                "id": files[i].id
            })
            tempNotFound.push({
                "id": files[i].id
            })
            fs.writeFileSync('./record.json', JSON.stringify({
                "latest_step": i,
                "errorList": tempError,
                "notFound": tempNotFound
            }))
            await sleeps()
            continue;
        }
        tempError = tempError.filter((x) => x.id != files[i].id);
        let { id, name, symbol, description, links, image, detail_platforms } = coinData;
        fs.writeFileSync('./record.json', JSON.stringify({
            "latest_step": i,
            "errorList": tempError,
            "notFound": tempNotFound
        }))
        fs.writeFileSync(`./assets/${id}/info.json`, JSON.stringify({
            "name": name,
            "id": id,
            "symbol": symbol,
            "description": description.en.replace(/\s+/g, ' ').trim(),
            "links": links.homepage[0],
            "logo": `https://raw.githubusercontent.com/Xellar-Protocol/xellar-assets/master/assets/${id}/logo.png`,
            "detail_platform": detail_platforms
        }));
        console.log('\x1b[33m%s\x1b[0m', `done ${id} -> ${i}/${files.length}`);
        await sleeps()
    }
}

async function doFetch(Coinid) {
    try {
        var coinData = await axios.get(`https://api.coingecko.com/api/v3/coins/${Coinid}?tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`)
        let { id, name, symbol, description, links, image, detail_platforms } = coinData.data;
        return {
            id, name, symbol, description, links, image, detail_platforms
        }
    } catch (e) {
        console.log(`retrying ${Coinid}`)
        await sleeps()
        var coinData = await axios.get(`https://api.coingecko.com/api/v3/coins/${Coinid}?tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`).catch((e) => {
            throw e.response.statusText
        })
        let { id, name, symbol, description, links, image, detail_platforms } = coinData.data;
        return {
            id, name, symbol, description, links, image, detail_platforms
        }
    }
}

const fetchAllTokens = async () => {
    fs.readFile('./idlist.json', 'utf8', async function (err, data) {
        const obj = JSON.parse(data);


        let count = 0;
        let queryParam = [];

        var latest = JSON.parse(fs.readFileSync('./record.json', 'utf8'));
        for (var i = latest['latest_step'] ?? 0; i < obj.length; i++) {

            try {
                var info = JSON.parse(fs.readFileSync(`./assets/${obj[i]['id']}/info.json`, 'utf8'));
                console.log(`skip ${obj[i]['id']}`)
            }
            catch (e) {
                console.log('\x1b[33m%s\x1b[0m', `fetching -> ${i}/${obj.length}`);
            }

            count++;
            let coinData;
            let tempError = [];

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
            let { id, name, symbol, description, links, image, detail_platforms } = coinData.data;


            await fs.promises.mkdir(`./assets/${id}`, { recursive: true })
            fs.writeFileSync('./record.json', JSON.stringify({
                "latest_step": i,
                "errorList": tempError
            }))

            try {
                fs.writeFileSync(`./assets/${id}/info.json`, JSON.stringify({
                    "name": name,
                    "id": id,
                    "symbol": symbol,
                    "description": description.en.replace(/\s+/g, ' ').trim(),
                    "links": links.homepage[0],
                    "logo": `https://raw.githubusercontent.com/Xellar-Protocol/xellar-assets/master/assets/${id}/logo.png`,
                    "detail_platform": detail_platforms
                }));
            } catch (e) {
                fs.writeFileSync(`./assets/${id}/info.json`, JSON.stringify({
                    "name": name,
                    "id": id,
                    "symbol": symbol,
                    "description": description.en,
                    "links": links.homepage[0],
                    "logo": `https://raw.githubusercontent.com/Xellar-Protocol/xellar-assets/master/assets/${id}/logo.png`,
                    "detail_platform": detail_platforms
                }));
            }
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

}


const getIdList = async () => {
    const result = await axios.get('https://api.coingecko.com/api/v3/coins/list');
    fs.writeFileSync('./idlist.json', JSON.stringify(result.data));
}



(async () => {
    // STEP //
    // 
    // get idlist.json
    // fetchAllTokens
    // fetchAllErrorTokenDetailData -->> fill error data
    // getIdList().then(() => {
    //     fetchAllTokens();
    // })
    constructTokenList({
        fileName: "tokenlist2.json"
    })

})()


