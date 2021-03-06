const { Credentials } = require('uport-credentials')
const blake = require('blakejs')

const {did, privateKey}=Credentials.createIdentity();
const credentials = new Credentials({
    appName: 'Test', did, privateKey
})

const id2=Credentials.createIdentity();
const did2=id2.did
const privateKey2=id2.privateKey

const credentials2 = new Credentials({
    appName: 'Test2', did: did2, privateKey: privateKey2
})

const webDid = 'did:web:uport.space';
const credentialsUportSpace = new Credentials({
    appName: 'TestUportSpace', did: webDid, privateKey: process.env.UPORT_SPACE_PRIVATE_KEY
})

//Nacl-DID
const naclDidLib = require('nacl-did')
const naclIdentity = naclDidLib.createIdentity()
const naclDid = naclIdentity.did;

const f=(async()=>{
    //Create AuthToken
    const authTokenPL={
        sub: did,
        claim: {
            access: []
        }
    }
    const authToken=await credentials.signJWT(authTokenPL)

    //Create Edge JWT
    const edgePayload={
        sub: did,
        type: 'ALL',
        vis: 'ANY',
        tag: 'test',
        data: 'anyData'
    }
    const edgeJWT  = await credentials2.signJWT(edgePayload);
    const edgeHash = blake.blake2bHex(edgeJWT);

    //Create NaClEdge
    const naclEdgeJWT = naclIdentity.createJWT(edgePayload)
    const naclEdgeHash = blake.blake2bHex(naclEdgeJWT);

    //Create uPortSpaceEdge
    const webEdgeJWT = await credentialsUportSpace.signJWT(edgePayload);
    const webEdgeHash = blake.blake2bHex(webEdgeJWT);


    //Create Edge JWT with AUD
    const edgeAudPayload={
        sub: did,
        type: 'ALL',
        vis: 'ANY',
        tag: 'test',
        data: 'anyData',
        aud: did
    }
    const edgeAudJWT  = await credentials2.signJWT(edgeAudPayload);
    const edgeAudHash = blake.blake2bHex(edgeAudJWT);

    
    //Create AuthzToken
    const authzPL={
        sub:did2,
        claim: {
            action: 'read',
            condition: {
                from: did2
            }
        }
    }
    const authzToken=await credentials.signJWT(authzPL);
    //Create AuthToken2
    const authToken2PL={
        sub: did2,
        claim: {
            access: [authzToken]
        }
    }
    const authToken2=await credentials2.signJWT(authToken2PL)

    //Env Vars
    const envVars={
        mouroUrl: process.argv[2],
        authToken: authToken,
        did: did,
        did2: did2,
        naclDid: naclDid,
        webDid: webDid,
        edgeJWT: edgeJWT,
        edgeHash: edgeHash,
        naclEdgeJWT: naclEdgeJWT,
        naclEdgeHash: naclEdgeHash,
        webEdgeJWT: webEdgeJWT,
        webEdgeHash: webEdgeHash,
        edgeAudJWT: edgeAudJWT,
        edgeAudHash: edgeAudHash,
        authToken2: authToken2
    }

    const envId=(new Date()).getTime()
    let env={
        id: envId,
        name: envId,
        values: []
    };
    for (const key in envVars){
        env.values.push({key: key, value: envVars[key]})
    }
    console.log(JSON.stringify(env,null,3));
})();

