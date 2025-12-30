import fs from 'fs';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import pm2 from 'pm2';

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

export const constructTokenList = ({
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

            // let tokenNetwork = Object.keys(info.detail_platform)
            // let intersection = supportedNetwork.filter(x => tokenNetwork.includes(x));
            // if (intersection.length == 0) {
            //     console.log('\x1b[33m%s\x1b[0m', `skip due to not supported network ${files[i]} -> ${i + 1}/${files.length}`);
            //     continue;
            // }

            // if (tokenNetwork.includes('')) {
            //     delete info.detail_platform['']
            // }

            // if (tokenNetwork.includes('native')) {
            //     delete info.detail_platform['native']
            // }

            // let isNative = findNativeByID(info.id)
            // let tempNative = nativeCurrency[info.id] ?? [];
            // if (isNative) {
            //     info.detail_platform['native'] = tempNative;
            //     nativeCurrencyIndex[info.id] = i;
            // }

            // if (!isNative && Object.keys(info.detail_platform).length == 0) {
            //     console.log('\x1b[33m%s\x1b[0m', `skip due to not supported network ${files[i]} -> ${i + 1}/${files.length}`);
            //     continue;
            // }

            // if (wrappedNative[info.id] !== undefined) {
            //     let wrapped = JSON.parse(fs.readFileSync(`./assets/${wrappedNative[info.id]}/info.json`, 'utf8'));
            //     info.detail_platform = {
            //         ...info.detail_platform,
            //         ...(wrapped.detail_platform ?? {})
            //     }
            // }

            // const isHaveNative = _.has(info.detail_platform, 'native')
            // if (isHaveNative) {

            //     Object.keys(info.detail_platform).forEach(function (key, index) {
            //         if (key != 'native') {
            //             info.detail_platform[key] = {
            //                 ...info.detail_platform[key],
            //                 wrapped: true
            //             }
            //         }
            //     });

            // }

            // info.logo = `https://raw.githubusercontent.com/Xellar-Protocol/xellar-assets/master/assets/${info.id}/logo.png`
            // fs.writeFileSync(`./assets/${info.id}/info.json`, JSON.stringify(info));

            constructJSON.push({
                "id": info.id,
                "name": info.name,
                "symbol": info.symbol,
                "logo": info.logo,
                "is_native": info.detail_platform.native !== undefined,
                "usd_market_cap": info.market_cap,
                "detail_platform": info.detail_platform
            })
            console.log('\x1b[33m%s\x1b[0m', `done ${files[i]} -> ${i + 1}/${files.length}`);
        } catch (e) {
            console.log(e)
            continue;
        }
    }
    fs.writeFileSync(`./${fileName}`, JSON.stringify(constructJSON))
    // markTokenIfNativeIsExisted()
    pm2.stop('parser', (err, proc) => {
        if (err) {
            console.log(err);
        }
        console.log('stop parser');
    });
    console.log('process done');
}
