const { execSync } = require('child_process');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Path to store connection string temporarily
const configPath = path.join(__dirname, '.telemetry-config.json');

// Function to prompt for the connection string
async function promptForConnectionString() {
  // Check if there's a saved config
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.connectionString) {
        return config.connectionString;
      }
    } catch (error) {
      console.error('Error reading saved config:', error);
    }
  }

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // Prompt for connection string
  return new Promise((resolve) => {
    rl.question('Enter your Application Insights connection string (or press Enter to skip telemetry): ', (answer) => {
      rl.close();
      
      // Save the connection string for future use
      if (answer) {
        try {
          fs.writeFileSync(configPath, JSON.stringify({ connectionString: answer }), 'utf8');
          console.log('Connection string saved for future builds.');
        } catch (error) {
          console.error('Failed to save connection string:', error);
        }
      }
      
      resolve(answer);
    });
  });
}

async function main() {
  try {
    // Get connection string
    const connectionString = await promptForConnectionString();
    
    // Set environment variable and run build
    const env = { ...process.env };
    if (connectionString) {
      env.PROMPTCODE_TELEMETRY_CONNECTION_STRING = connectionString;
    }
    
    // Run the build
    console.log('Building extension...');
    execSync('npm run build:prod', { 
      env, 
      stdio: 'inherit' 
    });
    
    console.log('Build completed successfully!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

main(); 