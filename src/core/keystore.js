const { ethers } = require('ethers')
const { DETERMINISTIC_MNEMONIC } = require('./flags')

class Keystore {
  constructor() {
    this._accounts = new Map() // address.toLowerCase() → { address, privateKey, locked }
  }

  async fromMnemonic(mnemonic, count = 10) {
    const phrase = mnemonic || DETERMINISTIC_MNEMONIC
    for (let i = 0; i < count; i++) {
      // ethers v6: pass the full path as 3rd arg to derive correctly
      const wallet = ethers.HDNodeWallet.fromPhrase(phrase, undefined, `m/44'/60'/0'/0/${i}`)
      this._store(wallet.address, wallet.privateKey, false)
    }
  }

  addAccount(address, privateKey) {
    this._store(address, privateKey, false)
    return address
  }

  _store(address, privateKey, locked) {
    this._accounts.set(address.toLowerCase(), { address, privateKey, locked })
  }

  unlock(address) {
    const acc = this._accounts.get(address.toLowerCase())
    if (acc) acc.locked = false
    return !!acc
  }

  lock(address) {
    const acc = this._accounts.get(address.toLowerCase())
    if (acc) acc.locked = true
    return !!acc
  }

  getPrivateKey(address) {
    const acc = this._accounts.get(address.toLowerCase())
    if (!acc || acc.locked) return null
    return acc.privateKey
  }

  list() {
    return [...this._accounts.values()].map(a => a.address)
  }

  async signMessage(address, data) {
    const pk = this.getPrivateKey(address)
    if (!pk) throw Object.assign(new Error('account is locked or not found'), { code: -32000 })
    const wallet = new ethers.Wallet(pk)
    return wallet.signMessage(ethers.getBytes(data))
  }

  async signTypedData(address, domain, types, message) {
    const pk = this.getPrivateKey(address)
    if (!pk) throw Object.assign(new Error('account is locked or not found'), { code: -32000 })
    const wallet = new ethers.Wallet(pk)
    const { EIP712Domain, ...cleanTypes } = types
    return wallet.signTypedData(domain, cleanTypes, message)
  }

  async sendTransaction(tx, internalUrl) {
    const from = tx.from
    const pk = this.getPrivateKey(from)
    if (!pk) throw Object.assign(new Error('account is locked or not found'), { code: -32000 })
    const provider = new ethers.JsonRpcProvider(internalUrl)
    const wallet = new ethers.Wallet(pk, provider)
    const resp = await wallet.sendTransaction({
      to: tx.to,
      value: tx.value != null ? BigInt(tx.value) : 0n,
      data: tx.data || '0x',
      ...(tx.gas && { gasLimit: BigInt(tx.gas) }),
      ...(tx.gasPrice && { gasPrice: BigInt(tx.gasPrice) }),
      ...(tx.nonce != null && { nonce: Number(tx.nonce) })
    })
    return resp.hash
  }
}

module.exports = { Keystore }
