async function run() {
  const url = 'https://dns.google/resolve?name=_mongodb._tcp.cluster0.yr29uns.mongodb.net&type=SRV';
  try {
    const response = await fetch(url);
    const data = await response.json();
    console.log('SRV Response:', JSON.stringify(data, null, 2));

    const txtUrl = 'https://dns.google/resolve?name=cluster0.yr29uns.mongodb.net&type=TXT';
    const txtResponse = await fetch(txtUrl);
    const txtData = await txtResponse.json();
    console.log('TXT Response:', JSON.stringify(txtData, null, 2));
  } catch (e) {
    console.error('Error fetching from Google DNS DoH:', e);
  }
}

run();
