const fs = require('fs');
const path = require('path');

/**
 * Injects the telemetry connection string into the telemetry.ts file
 * This script is meant to be run during the build process
 */
function injectTelemetryString() {
  // Get connection string from environment variable
  let connectionString = process.env.PROMPTCODE_TELEMETRY_CONNECTION_STRING;
  
  // If not in environment, try to get from config file
  if (!connectionString) {
    const configPath = path.join(__dirname, '.telemetry-config.json');
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

// Execute the function
injectTelemetryString(); 