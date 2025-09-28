import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '@utils/eventBus';

describe('EventBus', () => {
  let eventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should initialize with empty events object', () => {
    expect(eventBus.events).toEqual({});
    expect(eventBus.onceEvents).toEqual({});
  });

  describe('on()', () => {
    it('should add a callback to an event', () => {
      const callback = vi.fn();
      eventBus.on('test', callback);
      
      expect(eventBus.events.test).toHaveLength(1);
      expect(eventBus.events.test[0]).toBe(callback);
    });

    it('should create event array if it doesn\'t exist', () => {
      const callback = vi.fn();
      eventBus.on('newEvent', callback);
      
      expect(eventBus.events.newEvent).toBeDefined();
      expect(eventBus.events.newEvent).toHaveLength(1);
    });

    it('should allow multiple callbacks for same event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      eventBus.on('test', callback1);
      eventBus.on('test', callback2);
      
      expect(eventBus.events.test).toHaveLength(2);
    });

    it('should return instance for chaining', () => {
      const result = eventBus.on('test', vi.fn());
      expect(result).toBe(eventBus);
    });
  });

  describe('once()', () => {
    it('should add a callback to onceEvents', () => {
      const callback = vi.fn();
      eventBus.once('test', callback);
      
      expect(eventBus.onceEvents.test).toHaveLength(1);
      expect(eventBus.onceEvents.test[0]).toBe(callback);
    });

    it('should return instance for chaining', () => {
      const result = eventBus.once('test', vi.fn());
      expect(result).toBe(eventBus);
    });
  });

  describe('emit()', () => {
    it('should call all regular subscribers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const data = { test: 'data' };
      
      eventBus.on('test', callback1);
      eventBus.on('test', callback2);
      eventBus.emit('test', data);
      
      expect(callback1).toHaveBeenCalledWith(data);
      expect(callback2).toHaveBeenCalledWith(data);
    });

    it('should call once subscribers and remove them', () => {
      const callback = vi.fn();
      
      eventBus.once('test', callback);
      eventBus.emit('test', 'data');
      
      expect(callback).toHaveBeenCalledWith('data');
      expect(eventBus.onceEvents.test).toBeUndefined();
    });

    it('should handle errors in callbacks gracefully', () => {
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Test error');
      });
      const successCallback = vi.fn();
      
      eventBus.on('test', errorCallback);
      eventBus.on('test', successCallback);
      eventBus.emit('test', 'data');
      
      expect(console.error).toHaveBeenCalled();
      expect(successCallback).toHaveBeenCalled();
    });

    it('should do nothing if event has no subscribers', () => {
      expect(() => eventBus.emit('nonexistent')).not.toThrow();
    });

    it('should return instance for chaining', () => {
      const result = eventBus.emit('test', 'data');
      expect(result).toBe(eventBus);
    });
  });

  describe('off()', () => {
    it('should remove all subscribers for an event', () => {
      const callback = vi.fn();
      
      eventBus.on('test', callback);
      eventBus.once('test', callback);
      eventBus.off('test');
      
      expect(eventBus.events.test).toBeUndefined();
      expect(eventBus.onceEvents.test).toBeUndefined();
    });

    it('should return instance for chaining', () => {
      eventBus.on('test', vi.fn());
      const result = eventBus.off('test');
      expect(result).toBe(eventBus);
    });
  });

  describe('removeListener()', () => {
    it('should remove specific callback from regular subscribers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      eventBus.on('test', callback1);
      eventBus.on('test', callback2);
      eventBus.removeListener('test', callback1);
      
      expect(eventBus.events.test).toHaveLength(1);
      expect(eventBus.events.test[0]).toBe(callback2);
    });

    it('should remove specific callback from once subscribers', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      eventBus.once('test', callback1);
      eventBus.once('test', callback2);
      eventBus.removeListener('test', callback1);
      
      expect(eventBus.onceEvents.test).toHaveLength(1);
      expect(eventBus.onceEvents.test[0]).toBe(callback2);
    });

    it('should do nothing if callback not found', () => {
      const callback = vi.fn();
      
      eventBus.on('test', callback);
      eventBus.removeListener('test', vi.fn());
      
      expect(eventBus.events.test).toHaveLength(1);
    });
  });

  describe('getEventNames()', () => {
    it('should return all event names', () => {
      eventBus.on('event1', vi.fn());
      eventBus.once('event2', vi.fn());
      eventBus.on('event3', vi.fn());
      
      const names = eventBus.getEventNames();
      expect(names).toContain('event1');
      expect(names).toContain('event2');
      expect(names).toContain('event3');
      expect(names).toHaveLength(3);
    });

    it('should return empty array when no events', () => {
      expect(eventBus.getEventNames()).toEqual([]);
    });
  });

  describe('listenerCount()', () => {
    it('should return total count for an event', () => {
      eventBus.on('test', vi.fn());
      eventBus.on('test', vi.fn());
      eventBus.once('test', vi.fn());
      
      expect(eventBus.listenerCount('test')).toBe(3);
    });

    it('should return 0 for nonexistent event', () => {
      expect(eventBus.listenerCount('nonexistent')).toBe(0);
    });
  });

  describe('clear()', () => {
    it('should clear all events', () => {
      eventBus.on('event1', vi.fn());
      eventBus.once('event2', vi.fn());
      
      eventBus.clear();
      
      expect(eventBus.events).toEqual({});
      expect(eventBus.onceEvents).toEqual({});
    });

    it('should return instance for chaining', () => {
      const result = eventBus.clear();
      expect(result).toBe(eventBus);
    });
  });

  describe('integration', () => {
    it('should work with complex event flow', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const onceCallback = vi.fn();
      
      eventBus.on('test', callback1);
      eventBus.on('test', callback2);
      eventBus.once('test', onceCallback);
      
      eventBus.emit('test', 'data1');
      eventBus.emit('test', 'data2');
      
      expect(callback1).toHaveBeenCalledTimes(2);
      expect(callback2).toHaveBeenCalledTimes(2);
      expect(onceCallback).toHaveBeenCalledTimes(1);
      expect(onceCallback).toHaveBeenCalledWith('data1');
    });
  });
});