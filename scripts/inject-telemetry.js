const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Path to store connection string temporarily
const configPath = path.join(__dirname, '.telemetry-config.json');

/**
 * Gets the telemetry connection string from environment or config file
 * @returns {string|null} The connection string or null if not found
 */
function getTelemetryConnectionString() {
  // Get connection string from environment variable
  let connectionString = process.env.PROMPTCODE_TELEMETRY_CONNECTION_STRING;
  
  // If not in environment, try to get from config file
  if (!connectionString) {
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.connectionString) {
          connectionString = config.connectionString;
          console.log('Using connection string from .telemetry-config.json');
        }
      } catch (error) {
        console.error('Error reading telemetry config file:', error);
      }
    }
  }
  
  return connectionString;
}

/**
 * Prompts the user for a telemetry connection string and saves it
 * @returns {Promise<string|null>} The entered connection string
 */
async function promptTelemetryString() {
  // First check if there's already a connection string
  const existingString = getTelemetryConnectionString();
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    if (existingString) {
      const answer = await new Promise(resolve => {
        rl.question(`Found existing connection string. Use it? (Y/n): `, resolve);
      });
      
      if (answer.toLowerCase() !== 'n') {
        console.log('Using existing connection string.');
        process.env.PROMPTCODE_TELEMETRY_CONNECTION_STRING = existingString;
        return existingString;
      }
    }
    
    // Prompt for a new connection string
    const connectionString = await new Promise(resolve => {
      rl.question('Enter your Application Insights connection string (or press Enter to skip telemetry): ', resolve);
    });
    
    // Save the connection string for future use
    if (connectionString) {
      try {
        fs.writeFileSync(configPath, JSON.stringify({ connectionString }), 'utf8');
        console.log('Connection string saved for future builds.');
        process.env.PROMPTCODE_TELEMETRY_CONNECTION_STRING = connectionString;
      } catch (error) {
        console.error('Failed to save connection string:', error);
      }
    }
    
    return connectionString;
  } finally {
    rl.close();
  }
}

/**
 * Injects the telemetry connection string into the telemetry.ts file
 * This script is meant to be run during the build process
 */
function injectTelemetryString() {
  const connectionString = getTelemetryConnectionString();
  
  if (!connectionString) {
    console.warn('Warning: PROMPTCODE_TELEMETRY_CONNECTION_STRING environment variable not set and no valid .telemetry-config.json found. Telemetry will be disabled.');
    return;
  }

  const telemetryFilePath = path.join(__dirname, '..', 'out', 'telemetry.js');
  
  if (!fs.existsSync(telemetryFilePath)) {
    console.error(`Error: Telemetry file not found at ${telemetryFilePath}`);
    return;
  }

  try {
    // Read the file
    let content = fs.readFileSync(telemetryFilePath, 'utf8');
    
    // Replace the connection string placeholder with the actual value
    content = content.replace(
      /const CONNECTION_STRING = ['"](['"])/g, 
      `const CONNECTION_STRING = '${connectionString}'`
    );
    
    // Write the modified file
    fs.writeFileSync(telemetryFilePath, content, 'utf8');
    console.log('Successfully injected telemetry connection string.');
  } catch (error) {
    console.error('Failed to inject telemetry connection string:', error);
  }
}

// Export the function to be used by other scripts
module.exports = {
  getTelemetryConnectionString,
  injectTelemetryString,
  promptTelemetryString
};

// Execute the function when script is run directly
if (require.main === module) {
  injectTelemetryString();
} 