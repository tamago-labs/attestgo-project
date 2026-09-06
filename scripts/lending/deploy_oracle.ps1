$env:CREDITCOIN_RPC_URL = "https://rpc.cc3-testnet.creditcoin.network"
$env:PRIVATE_KEY = "0xab74d716e60629c9a138c9120ee253c0ff1dd5e523d61d157976dbdde93051e8"
$env:LOAN_TOKEN = "0x3f0e699Ad6F14324c93A23Cd57aef60Ffa09DA6a"
$env:COLLATERAL_TOKEN = "0x266F1BA9Cd984D8DC9cb7029A7c69e9d216283Db"
$env:COLLATERAL_USD = "1000000000000000000"
$env:LOAN_USD = "150000000000000000"
$env:LOAN_DECIMALS = "18"
$env:COLLATERAL_DECIMALS = "18"
& "C:\Users\pisut\.foundry\bin\forge.exe" script "script/6_DeployOracle.s.sol:DeployOracle" --rpc-url $env:CREDITCOIN_RPC_URL --broadcast
