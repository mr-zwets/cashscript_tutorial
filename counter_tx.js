const BCHJS = require("@psf/bch-js");
const {
    Contract,
    SignatureTemplate,
    ElectrumNetworkProvider,
} = require("cashscript");
const { hexToBin } = require("@bitauth/libauth");

run()
  
async function run(){
    // Instantiate a new contract using the compiled artifact, 
    // constructor params & network provider
    const artifact = require("./counter");

    // Initialise BCHJS
    const bchjs = new BCHJS();

    // Initialise HD node and alice's keypair
    const rootSeed = await bchjs.Mnemonic.toSeed("example-wallet");
    const hdNode = bchjs.HDNode.fromSeed(rootSeed);
    const alice = bchjs.HDNode.toKeyPair(bchjs.HDNode.derive(hdNode, 0));

    // Derive alice's public key and public key hash
    const alicePk = await bchjs.ECPair.toPublicKey(alice);
    const alicePkh = await bchjs.Crypto.hash160(alicePk);
    // Derive alice's address
    const aliceAddress = bchjs.ECPair.toCashAddress(alice);
    console.log(`aliceAddress: `, aliceAddress);

    const counterValue = 0;
    const counterValueHex = counterValue.toString(16);
    const counterValueByte = hexToBin(counterValueHex)

    const params = [alicePkh, counterValueByte];
    // Initialise a network provider for network operations on MAINNET
    const provider = new ElectrumNetworkProvider("mainnet");
    const contract = new Contract(artifact, params, provider);
  
    console.log("contract address:", contract.address);
    const contractBalance = await contract.getBalance();
    console.log("contract balance:", contractBalance);

    //assemble new redeemscripthex to get the p2shaddr to enforce as output 
    //when changing simulated state 
    const redeemScriptHex= contract.getRedeemScriptHex();
    let newRedeemScriptHex= redeemScriptHex.slice(2*2);
    const newCounterValue = counterValue + 1;
    const newCounterValueHex = newCounterValue.toString(16);
    newRedeemScriptHex= '01'+newCounterValueHex+newRedeemScriptHex;

    const bufferScript = Buffer.from(newRedeemScriptHex, 'hex');
    const p2sh_hash160 = bchjs.Crypto.hash160(bufferScript);
    const p2shAddr = bchjs.Address.hash160ToCash(p2sh_hash160, 0x05);
    console.log(`next state of the covenant will be enforced with outpoint ${p2shAddr}`);

    const meepTx1 = await contract.functions
        .spend(alicePk, new SignatureTemplate(alice))
        .to(aliceAddress,contract.balance-1000)
        .meep();
  
    const meepTx2 = await contract.functions
        .increment(alicePk, new SignatureTemplate(alice))
        .to(p2shAddr, contract.balance-1000)
        .withHardcodedFee(1000)
        .withoutChange()
        .meep();
}