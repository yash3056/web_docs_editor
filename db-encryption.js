/**
 * Database encryption key management utility
 * 
 * This script helps manage the encryption key for the SQLite database.
 * It can generate a new key, store it securely in the system's credential store,
 * and retrieve it when needed.
 */

const crypto = require('crypto');
const keytar = require('keytar'); // Cross-platform credential store

// Service and account constants for keytar
const SERVICE_NAME = 'web_docs_editor';
const ACCOUNT_NAME = 'database_encryption';

/**
 * Generate a new encryption key
 * @returns {string} The generated encryption key
 */
function generateEncryptionKey() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Save the encryption key to the system's secure credential store
 * @param {string} key The encryption key to save
 * @returns {Promise<void>}
 */
async function saveEncryptionKey(key) {
  try {
    await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, key);
    console.log('Encryption key saved to system credential store');
  } catch (error) {
    console.error('Error saving encryption key:', error);
    throw error;
  }
}

/**
 * Load the encryption key from the system's secure credential store
 * @returns {Promise<string|null>} The encryption key or null if not found
 */
async function loadEncryptionKey() {
  try {
    const key = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
    return key || null;
  } catch (error) {
    console.error('Error loading encryption key:', error);
    return null;
  }
}

/**
 * Initialize the encryption key (generate if not exists)
 * @returns {Promise<string>} The encryption key
 */
async function initializeEncryptionKey() {
  let key = await loadEncryptionKey();
  
  if (!key) {
    key = generateEncryptionKey();
    await saveEncryptionKey(key);
  }
  
  return key;
}

module.exports = {
  generateEncryptionKey,
  saveEncryptionKey,
  loadEncryptionKey,
  initializeEncryptionKey
};