const fs = require('fs')
const axios = require('axios');
const { resolve } = require('path');
const { isEmpty, _ } = require('lodash');
const { default: axiosRetry } = require('axios-retry');

axiosRetry(axios, { 
    retries: 10,
    retryDelay: (retryCount) => {
        console.log('\x1b[31m%s\x1b[0m',`retry attempt: ${retryCount} || with delay: 10 seconds`);
        return 10000;
    },
    retryCondition: (error) => {
        return error.response.status === 503 || error.response.status === 429;
    }
});

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

const sleeps = async () => await new Promise(r => setTimeout(r, 10000));

const nativeCurrency = {
    'bitcoin': 
        {
            "network_id": "bitcoin"
        },
    'ethereum': [
        {
            "network_id": "ethereum"
        },
        {
            "network_id": "optimistic-ethereum"
        },
        {
            "network_id": "arbitrum-one"
        }
    ],
    'binancecoin': [
        {
            "network_id": "binance-smart-chain"
        }
    ],
    'matic-network': [
        {
            "network_id": "polygon-pos"
        }
    ],
    'avalanche-2': [
        {
            "network_id": "avalanche"
        }
    ],
    'fantom': [
        {
            "network_id": "fantom"
        }
    ],
    'solana': [
        {
            "network_id": "solana"
        }
    ],
}

const supportedNetwork = ["bitcoin", "ethereum", "polygon-pos", "binance-smart-chain", "avalanche", "fantom", "optimistic-ethereum", "arbitrum-one", "solana", '']

const wrappedNative = {
    "wrapped-bitcoin": "bitcoin",
    "wrapped-fantom": "fantom",
    "wrapped-solana": "solana",
    "wrapped-avax": "avalanche-2",
    "wmatic": "matic-network",
    "wbnb": "binancecoin",
    "weth": "ethereum"
}

const findNativeByID = (input) => {
    let nativeList = ["bitcoin", 'ethereum', 'binancecoin', 'matic-network', 'avalanche-2', 'fantom', 'solana'];
    //'tomochain', 'harmony', 'moonbeam', 'moonriver', 'kucoin-shares', 'kava',
    return !isEmpty(nativeList.filter((x) => x == input))
}

const constructTokenList = ({
    fileName = 'tokenlist.json'
}) => {
    let constructJSON = [];
    let nativeCurrencyIndex = {}
    const files = fs.readdirSync('./assets')
    for (var i = 0; i < files.length; i++) {
        try {
            var info = JSON.parse(fs.readFileSync(`./assets/${files[i]}/info.json`, 'utf8'));
            let tokenNetwork = Object.keys(info.detail_platform)
            let intersection = supportedNetwork.filter(x => tokenNetwork.includes(x));
            if (intersection.length == 0) {
                console.log('\x1b[33m%s\x1b[0m', `skip due to not supported network ${files[i]} -> ${i}/${files.length}`);
                continue;
            }

            if (tokenNetwork.includes('')) {
                delete info.detail_platform['']
            }

            let isNative = findNativeByID(info.id)
            let tempNative = nativeCurrency[info.id] ?? [];
            if (isNative) {
                info.detail_platform['native'] = tempNative;
                nativeCurrencyIndex[info.id] = i;
            }

            if (wrappedNative[info.id]) {
                constructJSON[nativeCurrencyIndex[wrappedNative[info.id]]]['detail_platform'] = {
                    ...constructJSON[nativeCurrencyIndex[wrappedNative[info.id]]]['detail_platform'],
                    ...info.detail_platform
                }
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

    for (var i = 0; i < files.length; i++) {
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

    constructTokenList({
        fileName: "tokenlist2.json"
    })
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
        var latest = JSON.parse(fs.readFileSync('./record.json', 'utf8'));

        for (var i = latest['latest_step'] ?? 0; i < obj.length; i++) {
            let tempError = latest['errorList'];

            try {
                var info = JSON.parse(fs.readFileSync(`./assets/${obj[i]['id']}/info.json`, 'utf8'));
                console.log(`skip ${obj[i]['id']}`)
            }
            catch (e) {
                console.log('\x1b[33m%s\x1b[0m', `fetching -> ${i}/${obj.length}`);

                try {
                    let coinData = await axios.get(`https://api.coingecko.com/api/v3/coins/${obj[i]['id']}?tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`)

                    let { id, name, symbol, description, links, image, detail_platforms } = coinData.data;
                    await fs.promises.mkdir(`./assets/${id}`, { recursive: true })

                    // write token info
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

                        console.log('\x1b[33m%s\x1b[0m', `create token info -> ${obj[i]['id']}`);
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

                    // download token image
                    try {
                        await downloadImage(image.large, `./assets/${id}/logo.png`);
                    } catch (e) {
                        console.log('missing image')
                        await downloadImage("https://assets.coingecko.com/coins/images/1/large/bitcoin.png?1547033579", `./assets/${id}/logo.png`);
                    }

                    console.log('\x1b[33m%s\x1b[0m', `done -> ${i}/${obj.length}`);
                    await sleeps()
                } catch (e) {
                    console.log(e.response.statusText);
                    console.log(e.response.data.status);
                    tempError.push({
                        "id": obj[i]['id']
                    })
                    console.log('missing coin / token data')
                }
            }

            fs.writeFileSync('./record.json', JSON.stringify({
                "latest_step": i,
                "errorList": tempError
            }))
        }

        await fetchAllErrorTokenDetailData();
    });

}


const getIdList = async () => {
    const result = await axios.get('https://api.coingecko.com/api/v3/coins/list');
    await fs.writeFileSync('./idlist.json', JSON.stringify(result.data));
}

const rewrite = async (coin) => {
    if (coin) {
        const data = JSON.parse(fs.readFileSync("./tokenlist2.json", "utf8"));
        const coindata = data.find((item) => {return item.id == coin});
        const old = JSON.parse(
            fs.readFileSync(`./assets/${coindata.id}/info.json`, "utf8")
        );
        fs.writeFileSync(
            `./assets/${coindata.id}/info.json`,
            JSON.stringify({
                name: coindata.name,
                id: coindata.id,
                symbol: coindata.symbol,
                description: old.description,
                links: old.links,
                logo: `https://raw.githubusercontent.com/Xellar-Protocol/xellar-assets/master/assets/${coindata.id}/logo.png`,
                detail_platform: coindata.detail_platform,
            })
        );
    } else {
        const data = JSON.parse(fs.readFileSync('./tokenlist2.json', 'utf8'));
        for (let i = 0; i < data.length; i++) {
            const item = data[i];
            const old = JSON.parse(fs.readFileSync(`./assets/${item.id}/info.json`, 'utf8'));
            fs.writeFileSync(`./assets/${item.id}/info.json`, JSON.stringify({
                "name": item.name,
                "id": item.id,
                "symbol": item.symbol,
                "description": old.description,
                "links": old.links,
                "logo": `https://raw.githubusercontent.com/Xellar-Protocol/xellar-assets/master/assets/${item.id}/logo.png`,
                "detail_platform": item.detail_platform
            }));
        }
    }
}

(async () => {
    // STEP //
    // 
    // get idlist.json
    // fetchAllTokens
    // fetchAllErrorTokenDetailData -->> fill error data
    // await getIdList()
    // await fetchAllTokens();
    // await rewrite('bitcoin');
    constructTokenList({
        fileName: "tokenlist2.json"
    })
})()


