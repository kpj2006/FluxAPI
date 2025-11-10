export const POST = async (req: Request) => {
  try {
    const body = await req.json();

    const PINATA_API_KEY = process.env.PINATA_API_KEY;
    const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;
    const PINATA_JWT = process.env.PINATA_JWT;
    // Use the official Pinata API endpoint for pinning JSON
    const pinataUrl = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';
    if (!PINATA_API_KEY && !PINATA_JWT) {
      return Response.json({ error: 'Pinata credentials not found in env' }, { status: 500 });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (PINATA_JWT) {
      headers['Authorization'] = `Bearer ${PINATA_JWT}`;
    } else {
      headers['pinata_api_key'] = PINATA_API_KEY!;
      headers['pinata_secret_api_key'] = PINATA_SECRET_API_KEY!;
    }

    const response = await fetch(pinataUrl!, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        pinataContent: body,
      }),
    });



    let data;
    try {
      data = await response.json();
      console.log('Pinata response:', JSON.stringify(data, null, 2));
    } catch (jsonErr) {
      const text = await response.text();
      console.error('Pinata response not JSON:', text);
      return Response.json({ error: 'Pinata error: ' + text }, { status: 500 });
    }
    
    // Extract CID from Pinata response - it could be IpfsHash or ipfsHash
    const cid = data.IpfsHash || data.ipfsHash || data.cid;
    
    if (!cid) {
      console.error('No CID found in Pinata response:', data);
      return Response.json({ error: 'Pinata did not return a CID' }, { status: 500 });
    }
    
    console.log('IPFS CID:', cid);
    
    // Store the listing in the backend database
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4021';
    console.log('Storing listing at:', `${backendUrl}/store-listing`);
    
    try {
      const storeResponse = await fetch(`${backendUrl}/store-listing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cid: cid, ownerId: body.fundReceivingAddress }),
      });
      
      if (!storeResponse.ok) {
        const errorText = await storeResponse.text();
        console.error('Failed to store listing in backend:', errorText);
        return Response.json({ 
          error: 'API uploaded to IPFS but failed to store in database: ' + errorText,
          cid: cid 
        }, { status: 500 });
      }
      
      const storeResult = await storeResponse.json();
      console.log('Listing stored successfully:', storeResult);
    } catch (err: any) {
      console.error('Error storing listing:', err);
      return Response.json({ 
        error: 'API uploaded to IPFS but failed to store in database: ' + err.message,
        cid: cid 
      }, { status: 500 });
    }
    
    return Response.json({ cid: cid });
  } catch (error: any) {
    console.log(error);
    return Response.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
};
