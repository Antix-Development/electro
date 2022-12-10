module.exports = {
  packagerConfig: {
    icon: './icon/icon' // no file extension required
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-zip',
      config: {
        options: {
        }
      }
    },
    // {
    //   name: '@electron-forge/maker-squirrel',
    //   config: {
    //     options: {
    //     }
    //   }
    // },
    // {
    //   name: '@electron-forge/maker-deb',
    //   config: {
    //     options: {
    //       icon: './icon/icon'
    //     }
    //   }
    // },
    // {
    //   name: '@electron-forge/maker-rpm',
    //   config: {
    //     options: {
    //     }
    //   }
    // },
  ],
};
