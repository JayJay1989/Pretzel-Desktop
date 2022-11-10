## Pretzel-Desktop

[![pretzeldesktop](https://snapcraft.io//pretzeldesktop/badge.svg)](https://snapcraft.io/pretzeldesktop)

I have not any connection or whatsoever with pretzel or pretzel.rocks. This project is only made 'cause the lack of linux support for their app.
this repo is open for improvements.

# Installation

## Linux Snap

You can install Pretzel-Desktop with a snap. This is recommended method of installation for Linux as automatic updates will occur.

```bash
snap install pretzeldesktop
```

## Other distro's

Download the latest version from the [Github Releases here](https://github.com/JayJay1989/Pretzel-Desktop/releases).

# Developing

Installing dependencies:

```bash
sudo apt install libarchive-tools rpm pacman binutils
```

NPM commands:

```bash
git clone https://github.com/JayJay1989/Pretzel-Desktop.git
cd pretzeldesktop/

npm run install
npm run compile
npm run start
npm run build
```

### Commands
| Command   | Description  |
|---|---|
| `npm run start`  | Run electron app (in debug mode)  |
| `npm run compile`  | Compiles typescript  |
| `npm run build`  | Compiles the application |
| `npm run dist` | Compile electron app and distribute it |

 

 
