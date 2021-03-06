# _sierra-charlie_

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/cb-cities/sierra-charlie/blob/master/LICENSE.md)
[![CLA assistant](https://cla-assistant.io/readme/badge/cb-cities/sierra-charlie)](https://cla-assistant.io/cb-cities/sierra-charlie)
[![CircleCI](https://circleci.com/gh/cb-cities/sierra-charlie.svg?style=svg&circle-token=11d612a668f402164098ac05ff503a248ed8a59a)](https://circleci.com/gh/cb-cities/sierra-charlie)
[![Dependencies status](https://david-dm.org/cb-cities/sierra-charlie/status.svg)](https://david-dm.org/cb-cities/sierra-charlie)

### Usage

This project does not include input files. These input files describe the network you wish to visualise, i.e. the roads and junctions. These are required inside the `json` folder.
The schema for these files is found in the `json-schema` directory.

### Installing dependencies

Portions of the code are written in [PureScript](http://www.purescript.org/) and [Elm](http://elm-lang.org/).  Compilers for both languages and the [Node.js](https://nodejs.org/) runtime must be installed on the local machine.

The project is developed on OS X, but may support other UNIX platforms.  On OS X, system-level dependencies should be installed with the [`brew`](http://brew.sh/) tool.

```
brew install node purescript
```

[Webpack](https://webpack.github.io/) is used to structure the project, supporting development and production mode builds.  ES2015 syntax is translated to JavaScript using [Babel](http://babeljs.io/).  Code quality is monitored using [JSHint](http://jshint.com/).

Use [`yarn`](https://yarnpkg.com/lang/en/) tool to install project-level dependencies.

This project was built for elm version `0.16`. `yarn` may be used to install this

```
yarn add elm@0.16.0
```

Use `yarn` to install packages. If you don't have `yarn`, install it using `npm install -g yarn`.

```
yarn install
```

You will also need to increase the kernel limits on OS X.

```
sudo bash -c 'echo "kern.maxfiles=65536" >>/etc/sysctl.conf'
sudo bash -c 'echo "kern.maxfilesperproc=65536" >>/etc/sysctl.conf'
echo "ulimit -n 65536" >>~/.bash_profile
```

This may require you to restart your computer.


### Building the project

The same `npm` tool is also used to build the project, and to simplify other project-related tasks.

To build the project, give the following command:

```
npm run build
```

If the build is successful, the project is ready to run.  In one session, start a local CORS proxy:

```
npm run start-proxy
```

In another session, start a local HTTP server:

```
npm start
```

Finally, navigate to the following address in a web browser:

[http://localhost:3000](http://localhost:3000)
