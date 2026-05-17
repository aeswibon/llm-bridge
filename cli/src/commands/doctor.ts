import http from 'node:http';
import { readConfig } from '../utils/config.js';
import fs from 'node:fs';
import { configPath } from '@llm-bridge/core';

export async function doctorCommand(): Promise<void> {
  const config = readConfig();
  console.log('llm-bridge diagnostics\n');
  console.log(`Config: ${configPath()}`);
  console.log(`Active plugin: ${config.activePlugin ?? config.defaultPlugin}`);
  console.log(`Port: ${config.port}`);
  console.log(`Host: ${config.host}`);
  console.log(`Tool mode: ${config.toolMode}`);

  if (fs.existsSync(configPath())) {
    console.log('✓ Config file exists');
  } else {
    console.log('✗ Config file not found (using defaults)');
  }

  const activePlugin = config.activePlugin ?? config.defaultPlugin;
  const pluginConfig = config.plugins[activePlugin];
  if (pluginConfig && Object.keys(pluginConfig).length > 0) {
    console.log(`✓ Plugin "${activePlugin}" has configuration`);
  } else {
    console.log(`✗ Plugin "${activePlugin}" has no configuration`);
  }

  try {
    const res = await new Promise<number>((resolve, reject) => {
      http
        .get(`http://${config.host}:${config.port}/health`, (res) => {
          resolve(res.statusCode ?? 0);
        })
        .on('error', reject);
    });
    if (res === 200) {
      console.log('✓ Bridge server is running');
    } else {
      console.log(`✗ Bridge server returned status ${res}`);
    }
  } catch {
    console.log('✗ Cannot reach bridge server (is it running?)');
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const server = http.createServer();
      server.listen(config.port, config.host, () => {
        server.close();
        resolve();
      });
      server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          reject(new Error('Port in use'));
        } else {
          resolve();
        }
      });
    });
    console.log(`✓ Port ${config.port} is available`);
  } catch {
    console.log(`✗ Port ${config.port} is already in use`);
  }
}
