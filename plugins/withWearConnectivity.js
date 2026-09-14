const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withWearConnectivity(config) {
  return withAndroidManifest(config, configWithManifest => {
    const manifest = configWithManifest.modResults.manifest;
    const application = manifest.application?.[0];
    if (!application) return configWithManifest;

    application.service = application.service || [];
    const serviceName = 'com.wearconnectivity.WearConnectivityTask';
    const exists = application.service.some(item => item.$?.['android:name'] === serviceName);

    if (!exists) {
      application.service.push({
        $: {
          'android:name': serviceName,
          'android:exported': 'false',
          'android:foregroundServiceType': 'dataSync|connectedDevice',
          'android:permission': 'android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE'
        }
      });
    }

    return configWithManifest;
  });
};
