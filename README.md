## Pretzel-Desktop

[![pretzeldesktop](https://snapcraft.io//pretzeldesktop/badge.svg)](https://snapcraft.io/pretzeldesktop)

I have not any connection or whatsoever with pretzel or pretzel.rocks. This project is only made 'cause the lack of linux support for their app.
this repo is open for improvements.

# Installation

## Linux Snap

You can install Pretzel-Desktop with a snap. This is recommended method of installation for Linux as automatic updates will occur.

```bash
snap install pretzeldesktop --channel=beta
```

Old (small) player
```bash
snap install pretzeldesktop
```

## Linux AppImage

Download the AppImage from the [Github Releases here](https://github.com/JayJay1989/Pretzel-Desktop/releases).

# Developing



```bash
git clone https://github.com/JayJay1989/Pretzel-Desktop.git
cd pretzeldesktop/

# For Windows
ln -s package.win.json package.json
# For Linux
ln -s package.linux.json package.json
# For Mac
ln -s package.mac.json package.json

npm install
npm compile
npm start
npm build
```

### Commands
| Command   | Description  |
|---|---|
| `npm compile`  | Compiles typescript  |
| `npm build`  | Compiles the application  |
| `npm start`  | Run electron app  |

 

 