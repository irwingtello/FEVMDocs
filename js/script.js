document.addEventListener("DOMContentLoaded", () => app.initialize());

class App {
  constructor() {
    this.web3Instance = null;
    this.account = null;
    this.requestPending = false;
    this.chainIdToNameMap = {
      314: { name: "Filecoin Mainnet", shortName: "Fil" },
      314159: { name: "Filecoin Testnet", shortName: "tFil" },
    };
  }

  initialize() {
    if (window.ethereum) {
      this.setupEventListeners();
    } else {
      this.displayInstallMetaMaskWarning();
    }
  }

  setupEventListeners() {
    document.getElementById('requestAccounts').addEventListener('click', () => this.handleAccountRequest());
    window.ethereum.on('chainChanged', () => this.handleChainChanged());
    document.getElementById('submitformSendTokens').addEventListener('click', (e) => this.sendTokens(e));
  }

  async handleAccountRequest() {
    const button = document.getElementById('requestAccounts');
    if (button.innerText === 'Connect to MetaMask' && !this.requestPending) {
      await this.connectToMetaMask();
    } else {
      this.disconnectMetaMask();
      this.clearOwnedTokens(); // Clear owned tokens when disconnecting
    }
  }

  async connectToMetaMask() {
    this.requestPending = true;
    try {
      await window.ethereum.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      this.web3Instance = new Web3(window.ethereum);
      this.account = accounts[0];
      this.updateUIAfterConnect(accounts[0]);
      await this.displayChainAndBlockInfo();
    } catch (error) {
      console.error(error);
    } finally {
      this.requestPending = false;
    }
  }

  disconnectMetaMask() {
    this.web3Instance = null;
    this.account = null;
    this.updateUIAfterDisconnect();
  }
  clearOwnedTokens() {
    const tokenInfo = document.getElementById('token-info');
    tokenInfo.style.display = 'none'; // Hide the "Owned Tokens" section
    const dropdown = document.getElementById('token-dropdown');
    dropdown.innerHTML = '<option value="" disabled selected>Select a token</option>'; // Clear the dropdown options
  }
  handleChainChanged() {
    this.displayChainAndBlockInfo();
  }

  async displayChainAndBlockInfo() {
    if (!this.web3Instance) return;
    const chainId = await this.web3Instance.eth.getChainId();
    const latestBlock = await this.web3Instance.eth.getBlockNumber();
    const blockchainName = this.chainIdToNameMap[chainId]?.name || "EVM Blockchain";
    this.updateBlockchainInfo(blockchainName, latestBlock);

    // Check if the user has owned tokens
    await this.getOwnedTokens(this.account);
}
async getOwnedTokens(walletAddress) {

    let tokens = await this.fetchTokenBalances(walletAddress);

    this.populateDropdown(tokens);

    // Show or hide the "Owned Tokens" section based on whether tokens are owned
    let tokenInfo = document.getElementById('token-info');
    if (tokens.length > 0) {
        tokenInfo.style.display = 'block';
    } else {
        tokenInfo.style.display = 'none';
    }
}

  async fetchTokenBalances(walletAddress) {
  
 
    const erc20ABI = [
      { "constant": true, "inputs": [{ "name": "_owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "name": "balance", "type": "uint256" }], "type": "function" },
      { "constant": true, "inputs": [], "name": "name", "outputs": [{ "name": "", "type": "string" }], "type": "function" },
      { "constant": true, "inputs": [], "name": "symbol", "outputs": [{ "name": "", "type": "string" }], "type": "function" }
    ];

    const tokenContracts = ['0x84479f70535be87DC753943b0876FB737aa854e7'];
    let tokens = [];

    for (const tokenAddress of tokenContracts) {
      let tokenContract = new this.web3Instance.eth.Contract(erc20ABI, tokenAddress);
      let balance = await tokenContract.methods.balanceOf(walletAddress).call();

      if (balance > 0) {
        tokens.push({
          contractAddress: tokenAddress,
          name: "MTK",
          symbol: "MTK",
          balance: (this.web3Instance.utils.fromWei(balance, 'ether')).toString() 
        });
      }
    }
    return tokens;
  }

  async sendTokens(e) {
    e.preventDefault();
    let tokenDetails = document.getElementById("token-dropdown").value.split(",");
    let recipient = document.getElementById('recipient').value.trim();
    let amount = document.getElementById('tokenAmount').value.trim();

    if (!tokenDetails || !recipient || !amount) {
      alert('Please fill in all fields.');
      return;
    }

    if (!this.web3Instance) {
      alert('Please install MetaMask to use this feature.');
      return;
    }

    try {
      
      const [symbol,, tokenAddress] = tokenDetails;
      
      await this.transferTokens(tokenAddress, recipient, amount);
      let token=[];
      alert(`Successfully sent ${amount} tokens to ${recipient}`);
      token.push({ contractAddress: tokenAddress, name: "MTK", symbol: "MTK", balance: (localStorage.getItem(tokenAddress) - amount).toString() });
      this.populateDropdown(token);
    } catch (error) {
      console.error('Transaction failed:', error);
      alert('Transaction failed. Please check the console for details.');
    }
    document.getElementById('tokenAmount').value = "0";
    document.getElementById('recipient').value = "";
  }

  async transferTokens(tokenAddress, recipient, amount) {
    const tokenContract = new this.web3Instance.eth.Contract([
      {
        "constant": false,
        "inputs": [{ "name": "_to", "type": "address" }, { "name": "_value", "type": "uint256" }],
        "name": "transfer",
        "outputs": [{ "name": "", "type": "bool" }],
        "payable": false,
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ], tokenAddress);

    const amountWei = this.web3Instance.utils.toWei(amount, 'ether');
    await tokenContract.methods.transfer(recipient, amountWei).send({ from: this.account });
  }

  populateDropdown(tokens) {
    let dropdown = document.getElementById('token-dropdown');
    dropdown.innerHTML = '<option value="" disabled selected>Select a token</option>';
    tokens.forEach(token => {
      let option = document.createElement('option');
      option.value = `${token.symbol},${token.balance},${token.contractAddress}`;
      option.textContent = `${token.name} (${token.symbol}): ${token.balance}`;
      localStorage.setItem(token.contractAddress,token.balance);
      dropdown.appendChild(option);
    });
  }

  displayInstallMetaMaskWarning() {
    document.getElementById("requestAccounts").innerHTML = "<a href='https://metamask.io/download/' target='_blank' style='color: yellow;' onmouseover=\"this.style.color='white';\" onmouseout=\"this.style.color='yellow';\">Please install MetaMask</a>";
  }

  async updateUIAfterConnect(account) {
    const button = document.getElementById('requestAccounts');
    const chainId = await this.web3Instance.eth.getChainId();

    this.web3Instance.eth.getBalance(account).then(balance => {
      button.innerHTML = `Account: ${account}<br>Balance: ${this.web3Instance.utils.fromWei(balance, 'ether')!=0?this.web3Instance.utils.fromWei(balance, 'ether'):0} ${this.chainIdToNameMap[chainId].shortName}`;
      button.style.textAlign = 'left';
    });
  }

  updateUIAfterDisconnect() {
    const button = document.getElementById('requestAccounts');
    button.innerText = 'Connect to MetaMask';
    document.getElementById("blockchain").innerText = `Chain ID: 0`;
  }

  updateBlockchainInfo(blockchainName, latestBlock) {
    document.getElementById("blockchain").innerText = `Blockchain: ${blockchainName}`;
    document.getElementById("latestBlock").innerText = `Latest Block: ${latestBlock}`;
  }
}

const app = new App();
