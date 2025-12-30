import { fetchTokens } from './fetchTokens.js';
import { getCoinsWithMarketCap } from './getCoinsWithMarketCap.js';

const service = async () => {
    const coins = await getCoinsWithMarketCap();
    await fetchTokens(coins);
}

service();
