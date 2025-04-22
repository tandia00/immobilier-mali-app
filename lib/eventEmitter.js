import { NativeEventEmitter, NativeModules } from 'react-native';

// Créer une instance unique de EventEmitter
const eventEmitter = new NativeEventEmitter(NativeModules.EventEmitter);

export { eventEmitter };
