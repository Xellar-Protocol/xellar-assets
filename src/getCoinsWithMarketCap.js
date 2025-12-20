import fs from 'fs';
import axios from 'axios';
import axiosRetry from 'axios-retry';

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

const sleeps = async () => await new Promise(r => setTimeout(r, 20000));

const getIdList = async () => {
    console.log('\x1b[32m%s\x1b[0m', 'STEP 2  >>>  fetching id list');
    const result = await axios.get('https://api.coingecko.com/api/v3/coins/list?include_platform=true');
    return result.data;
}

const getCoinlistWithMarketCap = async (page) => {
    console.log('\x1b[32m%s\x1b[0m', 'STEP 3  >>>  fetching coin list with market cap');
    const existing = [];
    for (let i = 0; i < page; i++) {
        const result = await axios.get(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=250&page=${i + 1}`);
        existing.push(...result.data);
        console.log(`done page ${i + 1} with total data ${existing.length}`);
        await sleeps()
    }
    return existing;
}

const mergeIdlistWithMarketcap = (data, market) => {
    console.log('\x1b[32m%s\x1b[0m', 'STEP 4  >>>  merge id list with market cap');
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
    return arr;
}

export const getCoinsWithMarketCap = async () => {
    const coinIds = await getIdList();
    const pageLength = Math.ceil(coinIds.length / 250);
    const coinsMarket = await getCoinlistWithMarketCap(1);
    console.log('coins with market cap length:', coinsMarket.length);
    const coins = mergeIdlistWithMarketcap(coinIds, coinsMarket);
    console.log('final coins length:', coins.length);
    console.log('\x1b[32m%s\x1b[0m', 'ALL DONE  >>>  data.json created with id list and market cap');
    return coins;
}
