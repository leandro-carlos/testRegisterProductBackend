const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const envFilePath = path.join(projectRoot, '.env');
const setupOnly = process.argv.includes('--setup-only');
const isWindows = process.platform === 'win32';

const foregroundChildren = [];

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((acc, line) => {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) {
        return acc;
      }

      const separatorIndex = trimmed.indexOf('=');

      if (separatorIndex === -1) {
        return acc;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      acc[key] = value;
      return acc;
    }, {});
}

function getSpawnConfig(command, args, options = {}) {
  if (isWindows && ['npm', 'npx'].includes(command)) {
    return {
      command: 'cmd',
      args: ['/c', `${command}.cmd`, ...args],
      options,
    };
  }

  return { command, args, options };
}

function runCommand(label, command, args, options = {}) {
  const spawnConfig = getSpawnConfig(command, args, options);
  const child = spawn(spawnConfig.command, spawnConfig.args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
    ...spawnConfig.options,
  });

  return new Promise((resolve, reject) => {
    child.on('error', (error) => {
      reject(new Error(`${label} falhou ao iniciar: ${error.message}`));
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${label} terminou com código ${code}.`));
    });
  });
}

function startBackgroundProcess(label, command, args) {
  const spawnConfig = getSpawnConfig(command, args);
  const child = spawn(spawnConfig.command, spawnConfig.args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
    ...spawnConfig.options,
  });

  child.on('error', (error) => {
    console.error(`[${label}] falhou ao iniciar: ${error.message}`);
  });

  child.on('exit', (code, signal) => {
    const abnormalExit =
      typeof code === 'number' ? code !== 0 : signal && signal !== 'SIGINT';

    if (abnormalExit) {
      console.error(
        `[${label}] finalizou inesperadamente (${code ?? signal ?? 'sem detalhes'}).`,
      );
    }
  });

  foregroundChildren.push(child);
  return child;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDatabase() {
  const attempts = 30;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await runCommand(
        'Verificação do PostgreSQL',
        'docker',
        ['exec', 'product-manager-db', 'pg_isready', '-U', 'postgres', '-d', 'product_manager'],
        { stdio: 'ignore' },
      );
      return;
    } catch (error) {
      if (attempt === attempts) {
        throw new Error('O PostgreSQL não ficou pronto a tempo.');
      }

      console.log(`Aguardando PostgreSQL ficar pronto (${attempt}/${attempts})...`);
      await wait(2000);
    }
  }
}

function waitForHttp(url, attempts = 30) {
  return new Promise((resolve, reject) => {
    let currentAttempt = 0;

    const tryRequest = () => {
      currentAttempt += 1;

      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.on('error', () => {
        if (currentAttempt >= attempts) {
          reject(new Error(`A API não respondeu em ${url}.`));
          return;
        }

        setTimeout(tryRequest, 2000);
      });

      request.setTimeout(2000, () => {
        request.destroy();
      });
    };

    tryRequest();
  });
}

function openUrl(url) {
  if (isWindows) {
    spawn('cmd', ['/c', 'start', '', url], {
      cwd: projectRoot,
      detached: true,
      stdio: 'ignore',
    }).unref();
    return;
  }

  if (process.platform === 'darwin') {
    spawn('open', [url], {
      cwd: projectRoot,
      detached: true,
      stdio: 'ignore',
    }).unref();
    return;
  }

  spawn('xdg-open', [url], {
    cwd: projectRoot,
    detached: true,
    stdio: 'ignore',
  }).unref();
}

function shutdown(signal) {
  for (const child of foregroundChildren) {
    if (!child.killed) {
      child.kill(signal);
    }
  }
}

process.on('SIGINT', () => {
  shutdown('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
  process.exit(0);
});

async function main() {
  const env = readEnvFile(envFilePath);
  const port = Number(env.PORT || process.env.PORT || 3000);
  const swaggerUrl = `http://localhost:${port}/docs`;

  console.log('Subindo container do PostgreSQL...');
  await runCommand('Docker Compose', 'docker', ['compose', 'up', '-d']);

  console.log('Esperando PostgreSQL ficar disponível...');
  await waitForDatabase();

  console.log('Gerando Prisma Client...');
  await runCommand('Prisma Generate', 'npx', ['prisma', 'generate']);

  console.log('Aplicando migrations existentes...');
  await runCommand('Prisma Migrate Deploy', 'npx', [
    'prisma',
    'migrate',
    'deploy',
  ]);

  if (setupOnly) {
    console.log('Setup concluído com --setup-only.');
    return;
  }

  console.log('Iniciando Prisma Studio...');
  startBackgroundProcess('Prisma Studio', 'npx', [
    'prisma',
    'studio',
    '--browser',
    'none',
  ]);

  console.log('Iniciando backend em modo watch...');
  startBackgroundProcess('Backend', 'npm', ['run', 'start:dev']);

  console.log('Aguardando a API responder para abrir o Swagger...');
  await waitForHttp(swaggerUrl);
  openUrl(swaggerUrl);

  console.log(`Ambiente disponível em ${swaggerUrl}`);
  console.log('Pressione Ctrl+C para encerrar o backend e o Prisma Studio.');

  await new Promise(() => {});
}

main().catch((error) => {
  console.error(error.message);
  shutdown('SIGTERM');
  process.exit(1);
});
