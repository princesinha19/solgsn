SolGSN: Solana Gas Station ⛽
============================
It is an Gas Station built on Solana and implemented using Rust.<br/>
This platform/network will allow users to do gas-less transactions. This network will allow Dapps on Solana to pay the gas fee of their users. A single user can also use this network.
Using this platform, One can pay transaction fee in other solana supported token as well. For eg. One can top-up account using USDC token instead of SOL.

 <br/><img src="https://cdn.discordapp.com/attachments/638285090018951171/776419295303172096/solgsn.png" height="500" width="900">
 
- A relayer will be used to publish the signed transaction and, the executor on relayer will pay the fee. The execution and fee deduction will be done through smart contract only. The consumer/user will first top-up their account using SOL or any SLP token. On a successful transaction execution, the fee will get deducted from top-up credit and get added to the executor (fee-payer).
- The executor can claim their earned fee anytime directly from the smart contract. We will include governance in future for changing fees etc.
- Also, the Dapp & User can withdraw their topup anytime if they want. The topup credit will be associated with account. The amount will be stored in the program account or smart contract.

Running Project Locally
=======================

1. Prerequisites: Make sure you've installed [Node.js] and [Rust with correct target][Rust]. You will also need `solana` installed.
2. Install dependencies: `npm install`
3. Start Solana on Localner: `sudo npm run localnet:up`
4. Build SolGSN program: `npm run build`
5. Execute program: `npm run start`

You will see output something like this:<br/><br/>
<img src="https://cdn.discordapp.com/attachments/771687256703893526/776496293429641256/cli.png" height="400" width="700">

Exploring The Code
==================

1. The "program" (smart contract) code lives in the `/src/program-rust` folder. This code gets deployed to
   the Solana blockchain when you run `npm run build`. This sort of
   code-that-runs-on-a-blockchain is called a "program". The best file to start with the program is `lib.rs`.
   
2. The client code for loading & testing lives in the `/src/client` folder. `/src/main.js` is a great
   place to start exploring. Note that it loads in `/src/index.js`, where you
   can see all the program function getting executed synchronusly.
