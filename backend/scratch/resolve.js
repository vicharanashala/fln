import dns from 'dns';

dns.resolveSrv('_mongodb._tcp.cluster0.yr29uns.mongodb.net', (err, addresses) => {
  if (err) {
    console.error('SRV Resolution failed:', err);
    return;
  }
  console.log('SRV Addresses:', addresses);
  
  dns.resolveTxt('cluster0.yr29uns.mongodb.net', (errTxt, txts) => {
    if (errTxt) {
      console.error('TXT Resolution failed:', errTxt);
      return;
    }
    console.log('TXT Records:', txts);
  });
});
