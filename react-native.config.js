// Viro is registered manually in MainApplication via flavor-specific ViroPackageList.
// Disabling Android autolink avoids duplicate packages and keeps the `noviro` flavor
// free of JNI load for libviro_renderer.so (ARM-only prebuilts).
module.exports = {
  dependencies: {
    '@reactvision/react-viro': {
      platforms: {
        android: null,
      },
    },
  },
};
