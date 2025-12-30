import { constructTokenList } from './constructTokenlist.js';
import { fetchTokens } from './fetchTokens.js';
import { getCoinsWithMarketCap } from './getCoinsWithMarketCap.js';

const service = async () => {
    // const coins = await getCoinsWithMarketCap();
    // await fetchTokens(coins);

    constructTokenList({
        fileName: "tokenlist2.json",
        isTop50: false
    });
}

service();
