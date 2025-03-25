const fs = require('fs');
const path = require('path');

/**
 * Injects the telemetry connection string into the telemetry.ts file
 * This script is meant to be run during the build process
 */
function injectTelemetryString() {
  // Get connection string from environment variable
  const connectionString = process.env.PROMPTCODE_TELEMETRY_CONNECTION_STRING;
  
  if (!connectionString) {
    console.warn('Warning: PROMPTCODE_TELEMETRY_CONNECTION_STRING environment variable not set. Telemetry will be disabled.');
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