const fs = require('fs')
const axios = require('axios');
const pm2 = require('pm2');
const { resolve } = require('path');
const { isEmpty, _ } = require('lodash');
const { default: axiosRetry } = require('axios-retry');

axiosRetry(axios, { 
    retries: 10,
    retryDelay: (retryCount) => {
        console.log('\x1b[31m%s\x1b[0m',`retry attempt: ${retryCount} || with delay: 5 minutes`);
        return 300000;
    },
    retryCondition: (error) => {
        console.log(error.response);
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

const sleeps = async () => await new Promise(r => setTimeout(r, 20000));

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
        },
        {
            "network_id": "base"
        },
        {
            "network_id": "lisk"
        }
    ],
    'binancecoin': 
        {
            "network_id": "binance-smart-chain"
        },
    'polygon-ecosystem-token': 
        {
            "network_id": "polygon-pos"
        },
    'avalanche-2': 
        {
            "network_id": "avalanche"
        },
    'fantom': 
        {
            "network_id": "fantom"
        },
    'solana': 
        {
            "network_id": "solana"
        },
    'immutable-x': 
        {
            "network_id": "immutable"
        },
    'okb': 
        {
            "network_id": "x-layer"
        },
    'tron':
        {
            "network_id": "tron"
        }
}

const supportedNetwork = ["bitcoin", "ethereum", "polygon-pos", "binance-smart-chain", "avalanche", "fantom", "optimistic-ethereum", "arbitrum-one", "base", "solana", "lisk", "immutable", "x-layer", 'tron', '', 'native']

const wrappedNative = {
    "bitcoin": "wrapped-bitcoin",
    "fantom": "wrapped-fantom",
    "solana": "wrapped-solana",
    "avalanche-2": "wrapped-avax",
    "immutable-x": "wrapped-immutable",
    "okb": "wrapped-okb",
    "tron": "wrapped-tron",
    "matic-network": "wmatic",
    "binancecoin": "wbnb",
    "ethereum": "weth"
}

const findNativeByID = (input) => {
    let nativeList = ["bitcoin", 'ethereum', 'binancecoin', 'polygon-ecosystem-token', 'avalanche-2', 'fantom', 'solana', 'immutable-x', 'okb', 'tron'];
    //'tomochain', 'harmony', 'moonbeam', 'moonriver', 'kucoin-shares', 'kava',
    return !isEmpty(nativeList.filter((x) => x == input))
}

const constructTokenList = ({
    fileName = 'tokenlist.json',
    isTop50 = false
}) => {
    let constructJSON = [];
    let nativeCurrencyIndex = {}
    const files = fs.readdirSync('./assets')
    for (var i = 0; i < files.length; i++) {
        try {
            // check if file info-new.json is exist, if not use info.json
            var info = JSON.parse(fs.readFileSync(`./assets/${files[i]}/info.json`, 'utf8'));

            // var info = JSON.parse(fs.readFileSync(`./assets/${files[i]}/info${isTop50 ? '-new' : ''}.json`, 'utf8'));
            // if (Object.values(wrappedNative).includes(info.id)) {
            //     console.log('\x1b[33m%s\x1b[0m', `skip wrapped coin ${files[i]} -> ${i + 1}/${files.length}`);
            //     continue;
            // }
            
            let tokenNetwork = Object.keys(info.detail_platform)
            let intersection = supportedNetwork.filter(x => tokenNetwork.includes(x));
            if (intersection.length == 0) {
                console.log('\x1b[33m%s\x1b[0m', `skip due to not supported network ${files[i]} -> ${i + 1}/${files.length}`);
                continue;
            }

            if (tokenNetwork.includes('')) {
                delete info.detail_platform['']
            }
            
            if (tokenNetwork.includes('native')) {
                delete info.detail_platform['native']
            }

            let isNative = findNativeByID(info.id)
            let tempNative = nativeCurrency[info.id] ?? [];
            if (isNative) {
                info.detail_platform['native'] = tempNative;
                nativeCurrencyIndex[info.id] = i;
            }

            if (!isNative && Object.keys(info.detail_platform).length == 0) {
                console.log('\x1b[33m%s\x1b[0m', `skip due to not supported network ${files[i]} -> ${i + 1}/${files.length}`);
                continue;
            }

            // if (wrappedNative[info.id] !== undefined) {
            //     let wrapped = JSON.parse(fs.readFileSync(`./assets/${wrappedNative[info.id]}/info.json`, 'utf8'));
            //     info.detail_platform = {
            //         ...info.detail_platform,
            //         ...(wrapped.detail_platform ?? {})
            //     }
            // }

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
            console.log('\x1b[33m%s\x1b[0m', `done ${files[i]} -> ${i + 1}/${files.length}`);
        } catch (e) {
            console.log(e)
            continue;
        }
    }
    fs.writeFileSync(`./${fileName}`, JSON.stringify(constructJSON))
    markTokenIfNativeIsExisted()
}

const fetchAllErrorTokenDetailData = async () => {
    var latest = JSON.parse(fs.readFileSync('./record.json', 'utf8'));
    const files = latest['errorList'] || [];
    let tempError = latest['errorList'] || [];
    let tempNotFound = latest['notFound'] || [];

    for (var i = 0; i < files.length; i++) {
        try {
            const coinData = await doFetch(files[i].id);
            tempError = tempError.filter((x) => x.id != files[i].id);
            
            const { id, name, symbol, description, links, image, detail_platforms } = coinData;
            const market_cap_rank = files[i].market_cap_rank;

            fs.writeFileSync('./record.json', JSON.stringify({
                "latest_step": i,
                "errorList": tempError,
                "notFound": tempNotFound
            }));

            if (!fs.existsSync(`./assets/${id}`)) {
                await fs.promises.mkdir(`./assets/${id}`, { recursive: true });
            }

            fs.writeFileSync(`./assets/${id}/info.json`, JSON.stringify({
                "name": name,
                "id": id,
                "symbol": symbol,
                "description": description.en.replace(/\s+/g, ' ').trim(),
                "links": links.homepage[0],
                "market_cap": files[i].market_cap,
                "market_cap_rank": files[i].market_cap_rank,
                "logo": `https://raw.githubusercontent.com/Xellar-Protocol/xellar-assets/master/assets/${id}/logo.png`,
                "detail_platform": detail_platforms
            }));

            console.log('\x1b[33m%s\x1b[0m', `done ${id} -> ${i + 1}/${files.length}`);
            await sleeps();

        } catch (e) {
            console.log(`missing coin / token data ${files[i].id}`);
            console.log(e);
            
            tempError = tempError.filter((x) => x.id != files[i].id) ?? [];
            
            fs.rmSync(`./assets/${files[i].id}`, { force: true, recursive: true });
            
            tempError.push({
                "id": files[i].id,
                "market_cap": files[i].market_cap,
                "market_cap_rank": files[i].market_cap_rank,
            });
            
            tempNotFound.push({
                "id": files[i].id,
                "market_cap": files[i].market_cap,
                "market_cap_rank": files[i].market_cap_rank,
            });

            fs.writeFileSync('./record.json', JSON.stringify({
                "latest_step": i,
                "errorList": tempError,
                "notFound": tempNotFound
            }));

            await sleeps();
            continue;
        }
    }

    constructTokenList({
        fileName: "tokenlist2.json",
        isTop50: false
    });
    
    // constructTokenList({
    //     fileName: "tokenlist2-new-top50.json",
    //     isTop50: true
    // });
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
    console.log('\x1b[32m%s\x1b[0m', 'STEP 5  >>>  fetching all tokens');
    fs.readFile('./data.json', 'utf8', async function (err, data) {
        const obj = JSON.parse(data);
        var latest = JSON.parse(fs.readFileSync('./record.json', 'utf8'));

        for (var i = latest['latest_step'] ?? 0; i < obj.length; i++) {
            let tempError = latest['errorList'];

            try {
                // var info = JSON.parse(fs.readFileSync(`./assets/${obj[i]['id']}/info.json`, 'utf8'));
                // console.log(`skip ${obj[i]['id']}`)
                console.log('\x1b[33m%s\x1b[0m', `fetching -> ${i + 1}/${obj.length}`);

                try {
                    let market_cap_rank = obj[i]['market_cap_rank'];
                    let coinData = await axios.get(`https://api.coingecko.com/api/v3/coins/${obj[i]['id']}?tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`)
                    let { id, name, symbol, description, links, image, detail_platforms } = coinData.data;
                    // check if folder exist
                    if (!fs.existsSync(`./assets/${id}`)) {
                        await fs.promises.mkdir(`./assets/${id}`, { recursive: true })
                    }

                    // write token info
                    try {
                        fs.writeFileSync(`./assets/${id}/info.json`, JSON.stringify({
                            "name": name,
                            "id": id,
                            "symbol": symbol,
                            "description": description.en.replace(/\s+/g, ' ').trim(),
                            "links": links.homepage[0],
                            "market_cap": obj[i]['market_cap'],
                            "market_cap_rank": obj[i]['market_cap_rank'],
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
                            "market_cap": obj[i]['market_cap'],
                            "market_cap_rank": obj[i]['market_cap_rank'],
                            "logo": `https://raw.githubusercontent.com/Xellar-Protocol/xellar-assets/master/assets/${id}/logo.png`,
                            "detail_platform": detail_platforms
                        }));

                        console.log('\x1b[33m%s\x1b[0m', `retry create token info -> ${obj[i]['id']}`);
                    }

                    // download token image
                    // check if image is exist
                    if (!fs.existsSync(`./assets/${id}/logo.png`)) {
                        try {
                            console.log('fetching image');
                            await downloadImage(image.large, `./assets/${id}/logo.png`);
                        } catch (e) {
                            console.log('missing image')
                            // await downloadImage("https://assets.coingecko.com/coins/images/1/large/bitcoin.png?1547033579", `./assets/${id}/logo.png`);
                        }
                    }

                    console.log('\x1b[33m%s\x1b[0m', `done -> ${i + 1}/${obj.length}`);
                    await sleeps()
                } catch (e) {
                    console.log(e.response.statusText);
                    console.log(e.response.data.status);
                    tempError.push({
                        "id": obj[i]['id'],
                        "market_cap": obj[i]['market_cap'],
                        "market_cap_rank": obj[i]['market_cap_rank'],
                    })
                    console.log('missing coin / token data')
                }
            } catch (e) {
                console.log(e)
                console.log('missing coin / token data')
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
    console.log('\x1b[32m%s\x1b[0m', 'STEP 2  >>>  fetching id list');
    const result = await axios.get('https://api.coingecko.com/api/v3/coins/list?include_platform=true');
    await fs.writeFileSync('./idlist.json', JSON.stringify(result.data));
}

const getCoinlistWithMarketCap = async (page) => {
    console.log('\x1b[32m%s\x1b[0m', 'STEP 3  >>>  fetching coin list with market cap');
    for (let i = 1; i < page; i++) {
        const result = await axios.get(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=250&page=${i}`);
        try {
            const existing = JSON.parse(fs.readFileSync(`./market.json`, 'utf8'));
            existing.push(...result.data);
            console.log('append to existing market file');
            await fs.writeFileSync(`./market.json`, JSON.stringify(existing));
        } catch (error) {
            console.log('create new market file');
            await fs.writeFileSync(`./market.json`, JSON.stringify(result.data));
        }
        const updated = JSON.parse(fs.readFileSync(`./market.json`, 'utf8'));
        console.log(`done page ${i} with total data ${updated.length}`);
        await sleeps()
    }
}

const mergeIdlistWithMarketcap = () => {
    console.log('\x1b[32m%s\x1b[0m', 'STEP 4  >>>  merge id list with market cap');
    const data = JSON.parse(fs.readFileSync('./idlist.json', 'utf8'));
    const market = JSON.parse(fs.readFileSync('./market.json', 'utf8'));
    const arr = [];
    for (let i = 0; i < data.length; i++) {
        const item = data[i];
        const match = market.find((x) => x.id == item.id);
        if (match) {
            item.market_cap = match.market_cap;
            item.market_cap_rank = match.market_cap_rank;
            arr.push(item);
        } else {
            item.market_cap = 0;
            item.market_cap_rank = null;
            arr.push(item);
        }
    }
    arr.sort((a, b) => b.market_cap - a.market_cap);
    fs.writeFileSync('./data.json', JSON.stringify(arr));
}

const mergeWrappedCoinWithCoin = (filename) => {
    console.log('\x1b[32m%s\x1b[0m', 'STEP 6  >>>  merge wrapped coin with coin');
    const data = JSON.parse(fs.readFileSync(`./${filename}`, "utf8"));
    const wrapped = [];
    for (let i = 0; i < data.length; i++) {
        const item = data[i];
        if (item.id.startsWith("wrapped")) {
            wrapped.push(item);
        }
    }
    console.log("wrapped coin length -> ", wrapped.length);

    const arr = [];
    for (let i = 0; i < data.length; i++) {
        const item = data[i];
        const match = wrapped.find((x) => x.id == `wrapped-${item.id}`);
        if (match) {
            const index = wrapped.findIndex(
                (x) => x.id == `wrapped-${item.id}`
            );
            wrapped.splice(index, 1);
            item.detail_platform = { ...item.detail_platform, ...match.detail_platform };
            arr.push(item);
        } else {
            if (item.id.startsWith("wrapped")) {
                continue;
            }
            arr.push(item);
        }
    }
    fs.writeFileSync("./mergedTokenlist.json", JSON.stringify(arr));
    console.log("done combine -> ", arr.length);
    fs.writeFileSync("./wrapped-left.json", JSON.stringify(wrapped));
    console.log("wrapped left -> ", wrapped.length);
};

// 

const updateTokenlistUsingData = () => {
    const data = JSON.parse(fs.readFileSync('./tokenlist2.json', 'utf8'));
    for (let i = 0; i < data.length; i++) {
        const item = data[i];
        try {
            const update = JSON.parse(fs.readFileSync(`./assets/${item.id}/info.json`, 'utf8'));
            const existingDetail = item.detail_platform ? Object.keys(item.detail_platform) : [];
            const updateDetail = update.detail_platform ? Object.keys(update.detail_platform) : [];
    
            if (updateDetail.includes('')) {
                updateDetail.splice(updateDetail.indexOf(''), 1);
            }
            if (updateDetail.includes('native')) {
                updateDetail.splice(updateDetail.indexOf('native'), 1);
            }
            
            const notIncluded = updateDetail.filter(x => !existingDetail.includes(x));
            if (notIncluded.length > 0) {
                for (let j = 0; j < notIncluded.length; j++) {
                    if (item.detail_platform == undefined) {
                        item.detail_platform = {
                            [notIncluded[j]]: update.detail_platform[notIncluded[j]]
                        }
                    } else item.detail_platform[notIncluded[j]] = update.detail_platform[notIncluded[j]];
                }
            } else {
                if (item.detail_platform == undefined) {
                    data.splice(i, 1);
                }
            }
        } catch (error) {
            console.log('not found ', item.id);
        }
    }
    fs.writeFileSync('./tokenlist2.json', JSON.stringify(data));
}

const markTokenIfNativeIsExisted = () => {
    const data = JSON.parse(fs.readFileSync('./tokenlist2.json', 'utf8'));
    for (let i = 0; i < data.length; i++) {
        const item = data[i];
        const isHaveNative = _.has(item.detail_platform, 'native')
        if (isHaveNative) {

            Object.keys(item.detail_platform).forEach(function (key, index) {
                if (key != 'native') {
                    item.detail_platform[key] = {
                        ...item.detail_platform[key],
                        wrapped: true
                    }
                }
            });

        }
    }
    fs.writeFileSync('./tokenlist2.json', JSON.stringify(data));
    pm2.stop('parser', (err, proc) => {
        if (err) {
            console.log(err);
        }
        console.log('stop parser');
    });
    console.log('process done');
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

const removeMarketAndResetRecord = () => {
    console.log('\x1b[32m%s\x1b[0m', 'STEP 1  >>>  remove market.json and reset record.json');
    fs.rmSync('./market.json', { force: true, recursive: true });
    fs.writeFileSync('./record.json', JSON.stringify({
        "latest_step": 0,
        "errorList": [],
        "notFound": []
    }));
}

(async () => {
    // ----- START ----- //
    // STEP 1 (MANUAL)
    // delete market.json & edit record.json to {"latest_step": 0, "errorList": [], "notFound": []}
    // STEP 1 (AUTO) comment if want to continue from previous fetch
    removeMarketAndResetRecord()
    // STEP 2
    await getIdList()
    // STEP 3
    await getCoinlistWithMarketCap(60)
    // STEP 4
    mergeIdlistWithMarketcap()
    // STEP 5 (Biasanya lama)
    await fetchAllTokens();
    // STEP 6
    // mergeWrappedCoinWithCoin('tokenlist2.json')
    // STEP 7
    // MANUAL CHECK BETWEEN mergedTokenlist.json AND wrapped-left.json
    // COPY mergedTokenlist.json TO tokenlist2.json
    // LAST STEP
    // markTokenIfNativeIsExisted()
    // ----- END ----- //
    // ADDITIONAL STEP
    // updateTokenlistUsingData()
})()


