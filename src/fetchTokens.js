import fs from 'fs';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import dotenv from 'dotenv';
import { nativeCurrency, supportedNetwork } from './supportedNetworkAndNativeCurrency.js';
import { constructTokenList } from './constructTokenlist.js';
dotenv.config();
axiosRetry(axios, {
    retries: 10,
    retryDelay: (retryCount) => {
        console.log('\x1b[31m%s\x1b[0m', `retry attempt: ${retryCount} || with delay: 5 minutes`);
        return 300000;
    },
    retryCondition: (error) => {
        console.log(error.response);
        return error.response.status === 503 || error.response.status === 429;
    }
});

const sleeps = async () => await new Promise(r => setTimeout(r, 20000));

export const fetchTokens = async (coins) => {
    console.log('\x1b[32m%s\x1b[0m', 'STEP 5  >>>  fetching all tokens');
    // fs.readFile('./data.json', 'utf8', async function (err, data) {
    // const obj = JSON.parse(data);
    // var latest = JSON.parse(fs.readFileSync('./record.json', 'utf8'));
    const latest = {
        "latest_step": 0,
        "errorList": [],
        "notFound": []
    }

    for (var i = latest['latest_step'] ?? 0; i < coins.length; i++) {
        let tempError = latest['errorList'];

        try {
            // var info = JSON.parse(fs.readFileSync(`./assets/${obj[i]['id']}/info.json`, 'utf8'));
            // console.log(`skip ${obj[i]['id']}`)
            console.log('\x1b[33m%s\x1b[0m', `fetching -> ${i + 1}/${coins.length}`);

            try {
                let market_cap_rank = coins[i]['market_cap_rank'];
                // let coinData = await axios.get(`https://api.coingecko.com/api/v3/coins/${coins[i]['id']}?tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`)
                const coinData = await doFetch(coins[i]['id']);
                let { id, name, symbol, description, links, image, detail_platforms } = coinData;

                let assetInfo = {
                    "name": name,
                    "id": id,
                    "symbol": symbol,
                    "description": description.en.replace(/\s+/g, ' ').trim(),
                    "links": links.homepage[0],
                    "market_cap": coins[i]['market_cap'],
                    "market_cap_rank": coins[i]['market_cap_rank'],
                    "logo": `https://raw.githubusercontent.com/Xellar-Protocol/xellar-assets/master/assets/${id}/logo.png`,
                    "detail_platform": detail_platforms
                }
                assetInfo = checkSupportedNetwork(assetInfo);
                const assets = seperateTokenPerNetwork(assetInfo);

                for (const asset of assets) {
                    // check if folder exist
                    if (!fs.existsSync(`./assets/${asset.id}`)) {
                        await fs.promises.mkdir(`./assets/${asset.id}`, { recursive: true })
                    }

                    // write token info
                    try {
                        fs.writeFileSync(`./assets/${asset.id}/info.json`, JSON.stringify(asset));

                        console.log('\x1b[33m%s\x1b[0m', `create token info -> ${asset.id}`);
                    } catch (e) {
                        fs.writeFileSync(`./assets/${asset.id}/info.json`, JSON.stringify(asset));

                        console.log('\x1b[33m%s\x1b[0m', `retry create token info -> ${asset.id}`);
                    }

                    try {
                        await axios.put('https://api.xellar.co/v1/coins/update', {
                            id: asset.id,
                            symbol: asset.symbol,
                            name: asset.name,
                            detail_platform: asset.detail_platform,
                            is_native: asset.is_native,
                            logo: asset.logo,
                            usd_market_cap: asset.market_cap,
                        }, {
                            headers: {
                                'x-static-token': process.env.XELLAR_STATIC_TOKEN
                            }
                        });
                    } catch (error) {
                        console.log('error:', error.response.data);
                    }

                    // download token image
                    // check if image is exist
                    if (!fs.existsSync(`./assets/${asset.id}/logo.png`)) {
                        try {
                            console.log('fetching image');
                            await downloadImage(image.large, `./assets/${asset.id}/logo.png`);
                        } catch (e) {
                            console.log('missing image')
                            // await downloadImage("https://assets.coingecko.com/coins/images/1/large/bitcoin.png?1547033579", `./assets/${id}/logo.png`);
                        }
                    }
                }

                console.log('\x1b[33m%s\x1b[0m', `done -> ${i + 1}/${coins.length}`);
                await sleeps()
            } catch (e) {
                console.log(e);
                console.log(e.response.statusText);
                console.log(e.response.data.status);
                tempError.push({
                    "id": coins[i]['id'],
                    "market_cap": coins[i]['market_cap'],
                    "market_cap_rank": coins[i]['market_cap_rank'],
                })
                console.log('missing coin / token data')
            }
        } catch (e) {
            console.log(e)
            console.log('missing coin / token data')
        }

        // fs.writeFileSync('./record.json', JSON.stringify({
        //     "latest_step": i,
        //     "errorList": tempError
        // }))
        latest['latest_step'] = i;
        latest['errorList'] = tempError;
    }

    await fetchAllErrorTokenDetailData(latest);
    // });
}

const fetchAllErrorTokenDetailData = async (latest) => {
    // var latest = JSON.parse(fs.readFileSync('./record.json', 'utf8'));
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

            let assetInfo = {
                "name": name,
                "id": id,
                "symbol": symbol,
                "description": description.en.replace(/\s+/g, ' ').trim(),
                "links": links.homepage[0],
                "market_cap": coins[i]['market_cap'],
                "market_cap_rank": coins[i]['market_cap_rank'],
                "logo": `https://raw.githubusercontent.com/Xellar-Protocol/xellar-assets/master/assets/${id}/logo.png`,
                "detail_platform": detail_platforms
            }
            assetInfo = checkSupportedNetwork(assetInfo);
            const assets = seperateTokenPerNetwork(assetInfo);

            for (const asset of assets) {

                if (!fs.existsSync(`./assets/${asset.id}`)) {
                    await fs.promises.mkdir(`./assets/${asset.id}`, { recursive: true })
                }
                // write token info
                try {
                    fs.writeFileSync(`./assets/${asset.id}/info.json`, JSON.stringify(asset));

                    console.log('\x1b[33m%s\x1b[0m', `create token info -> ${asset.id}`);
                } catch (e) {
                    fs.writeFileSync(`./assets/${asset.id}/info.json`, JSON.stringify(asset));

                    console.log('\x1b[33m%s\x1b[0m', `retry create token info -> ${asset.id}`);
                }

                try {
                    await axios.put('https://api.xellar.co/v1/coins/update', {
                        id: asset.id,
                        symbol: asset.symbol,
                        name: asset.name,
                        detail_platform: asset.detail_platform,
                        is_native: asset.is_native,
                        logo: asset.logo,
                        usd_market_cap: asset.market_cap,
                    }, {
                        headers: {
                            'x-static-token': process.env.XELLAR_STATIC_TOKEN
                        }
                    });
                } catch (error) {
                    console.log('error:', error.response.data);
                }

                // download token image
                // check if image is exist
                if (!fs.existsSync(`./assets/${asset.id}/logo.png`)) {
                    try {
                        console.log('fetching image');
                        await downloadImage(image.large, `./assets/${asset.id}/logo.png`);
                    } catch (e) {
                        console.log('missing image')
                        // await downloadImage("https://assets.coingecko.com/coins/images/1/large/bitcoin.png?1547033579", `./assets/${id}/logo.png`);
                    }
                }
            }

            // fs.writeFileSync(`./assets/${id}/info.json`, JSON.stringify({
            //     "name": name,
            //     "id": id,
            //     "symbol": symbol,
            //     "description": description.en.replace(/\s+/g, ' ').trim(),
            //     "links": links.homepage[0],
            //     "market_cap": files[i].market_cap,
            //     "market_cap_rank": files[i].market_cap_rank,
            //     "logo": `https://raw.githubusercontent.com/Xellar-Protocol/xellar-assets/master/assets/${id}/logo.png`,
            //     "detail_platform": detail_platforms
            // }));

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

const checkSupportedNetwork = (params) => {
    const networks = Object.keys(params.detail_platform);
    const supportedNetworks = networks.filter(x => supportedNetwork.includes(x));

    if (supportedNetworks.length === 0) {
        console.log('\x1b[31m%s\x1b[0m', `No supported network for ${params.id}`);
        return;
    }
    const supportedDetailPlatforms = {};
    supportedNetworks.forEach((network) => {
        supportedDetailPlatforms[network] = params.detail_platform[network];
    });

    return {
        ...params,
        detail_platform: supportedDetailPlatforms
    }
}

const seperateTokenPerNetwork = (token) => {
    const nativeCurrencies = Object.keys(nativeCurrency);
    const networks = Object.keys(token.detail_platform);
    const tokens = [];
    networks.forEach((network) => {
        if (network === '' || network === 'native') {
            if (nativeCurrencies.includes(token.id)) {
                const nativeCurrencyData = nativeCurrency[token.id];
                if (Array.isArray(nativeCurrencyData)) {
                    nativeCurrencyData.forEach((nativeCurr) => {
                        const nativeNetwork = nativeCurr.network_id;
                        tokens.push({
                            ...token,
                            id: token.id === nativeNetwork ? token.id : `${token.id}_${nativeNetwork}`,
                            is_native: true,
                            detail_platform: {
                                native: nativeCurr
                            }
                        });
                    });
                } else {
                    const nativeNetwork = nativeCurrencyData.network_id;
                    tokens.push({
                        ...token,
                        id: token.id,
                        // id: token.id === nativeNetwork ? token.id : `${token.id}_${nativeNetwork}`,
                        is_native: true,
                        detail_platform: {
                            native: nativeCurrencyData
                        }
                    });
                }
            }
        } else {
            tokens.push({
                ...token,
                id: `${token.id}_${network}`,
                is_native: (nativeCurrencies.includes(token.id) && (network === '' || network === 'native')) ? true : false,
                detail_platform: {
                    [network]: token.detail_platform[network]
                }
            });
        }
    });

    return tokens;
}

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