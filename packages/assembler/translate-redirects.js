const fs = require('fs-extra');

(async () => {
    const redir = await fs.readJson('./redirects.json');
    // const transformed = redir.reduce((agg, {type, from, to, status, cache}) => {
    //     return agg + `${type}\t${from}\t${status}\t${to}\t${cache}\n`;
    // }, '');
    //
    // // await fs.writeJson('./redirect-prefixes-small.json', transformed);
    // await fs.writeFile('./redirect-small.txt', transformed)

    const transformed = redir.reduce((agg, {type, from, to, status, cache}) => {
        const typed = agg[type] = agg[type] || {};
        typed[from] = {to, status, cache};
        return agg;
    }, {});

    await fs.writeJson('./json-object.json', transformed);

})();



