class EventRegister {
  static listeners = {};
  static eventCount = 0;

  static addEventListener(eventName, callback) {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = new Map();
    }
    
    const listenerId = ++this.eventCount;
    this.listeners[eventName].set(listenerId, callback);
    
    return () => {
      if (this.listeners[eventName]) {
        this.listeners[eventName].delete(listenerId);
        if (this.listeners[eventName].size === 0) {
          delete this.listeners[eventName];
        }
      }
    };
  }

  static removeEventListener(eventName, listenerId) {
    if (this.listeners[eventName]) {
      this.listeners[eventName].delete(listenerId);
      if (this.listeners[eventName].size === 0) {
        delete this.listeners[eventName];
      }
    }
  }

  static emit(eventName, data) {
    if (this.listeners[eventName]) {
      this.listeners[eventName].forEach(callback => {
        callback(data);
      });
    }
  }
}

export default EventRegister;
