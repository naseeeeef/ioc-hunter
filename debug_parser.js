import { IOCParser } from './js/parser.js';

const testInput = `
Category, IOC
Domain, fixyourallergywithus[.]com
Domain, red-letter[.]org
Domain, siriustimes[.]rocks
Domain, binance[.]comtr-katilim[.]com
IP Address, 80[.]78[.]25[.]205
`;

const results = IOCParser.parse(testInput);
console.log("Parsed Results:", JSON.stringify(results, null, 2));
console.log("Count:", results.length);
