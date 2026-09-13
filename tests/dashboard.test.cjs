const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../app/static/js/main.js'), 'utf8');

function dashboard(fetchImplementation) {
    const requests = [];
    const context = {
        console,
        AbortSignal,
        URLSearchParams,
        localStorage: { getItem: () => null, setItem() {} },
        document: { hidden: false, addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] },
        setInterval: () => 1,
        clearInterval() {},
        setTimeout: () => 1,
        clearTimeout() {},
        fetch: async (url, options) => {
            requests.push({ url, options });
            return fetchImplementation ? fetchImplementation(url, options) : { ok: true, json: async () => ({ success: true }) };
        },
        CAMERAS: { cam1: { name: 'Entrance' }, cam2: { name: 'Terrace' } },
        location: { search: '', host: 'localhost' },
        addEventListener() {}
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(source, context);
    vm.runInContext(`
        showNotification = () => {};
        state.currentCameraId = 'cam2';
        state.recordingKnown = true;
        state.motionKnown = true;
        state.cameraStatuses.cam2 = { state: 'connected', enabled: true };
    `, context);
    return { context, requests, run: code => vm.runInContext(code, context) };
}

test('recording, snapshot and motion actions target the selected camera', async () => {
    const app = dashboard();
    await app.context.toggleRecording();
    await app.context.captureSnapshot();
    await app.context.toggleMotion(true);
    assert.deepEqual(app.requests.map(request => request.url), [
        '/api/recording/start/cam2', '/api/snapshot/cam2', '/api/motion/enable/cam2'
    ]);
    assert.equal(app.run('state.isRecording'), true);
    assert.equal(app.run('state.motionEnabled'), true);
});

test('recording and motion responses from a previous selection are ignored', async () => {
    const pending = [];
    const app = dashboard(() => new Promise(resolve => pending.push(resolve)));
    const recording = app.context.checkRecordingStatus();
    const motion = app.context.loadMotionStatus();
    app.run("state.currentCameraId = 'cam1'; state.selectionVersion++; state.recordingKnown = false; state.motionKnown = false;");
    pending[0]({ ok: true, json: async () => ({ is_recording: true, duration: 17 }) });
    pending[1]({ ok: true, json: async () => ({ enabled: true, motion_detected: true }) });
    await Promise.all([recording, motion]);
    assert.equal(app.run('state.isRecording'), false);
    assert.equal(app.run('state.motionEnabled'), false);
    assert.equal(app.run('state.recordingKnown'), false);
    assert.equal(app.run('state.motionKnown'), false);
});

test('an in-flight recording action cannot overwrite the newly selected camera', async () => {
    let finish;
    const app = dashboard(() => new Promise(resolve => { finish = resolve; }));
    const recording = app.context.toggleRecording();
    app.run("state.currentCameraId = 'cam1'; state.selectionVersion++;");
    finish({ ok: true, json: async () => ({ success: true }) });
    await recording;
    assert.equal(app.run('state.isRecording'), false);
    assert.equal(app.run('state.cameraStatuses.cam2.is_recording'), true);
    assert.equal(app.run('state.recordingPending'), false);
});

test('failed actions leave the last confirmed state intact', async () => {
    const app = dashboard(async () => ({ ok: false, json: async () => ({ error: 'Unavailable' }) }));
    await app.context.toggleRecording();
    await app.context.toggleMotion(true);
    assert.equal(app.run('state.isRecording'), false);
    assert.equal(app.run('state.motionEnabled'), false);
    assert.equal(app.run('state.recordingPending'), false);
    assert.equal(app.run('state.motionPending'), false);
});

test('streams are reused while active and detached when hidden', () => {
    const app = dashboard();
    const attributes = new Map();
    let starts = 0;
    const image = {
        dataset: {},
        hidden: true,
        getAttribute: name => attributes.get(name),
        removeAttribute: name => attributes.delete(name),
        set src(value) { attributes.set('src', value); starts++; }
    };
    app.context.setStreamSource(image, 'cam2', true);
    app.context.setStreamSource(image, 'cam2', true);
    assert.equal(starts, 1);
    assert.equal(image.hidden, false);
    app.context.setStreamSource(image, 'cam2', false);
    assert.equal(attributes.has('src'), false);
    assert.equal(image.hidden, true);
});

test('recording timer polling does not accumulate intervals', () => {
    const app = dashboard();
    let cleared = 0;
    app.context.clearInterval = () => { cleared++; };
    app.context.startRecTimer(10);
    app.context.startRecTimer(20);
    assert.equal(cleared, 1);
    assert.equal(app.run('state.recSeconds'), 20);
});

test('camera identifiers are URL encoded', () => {
    const app = dashboard();
    assert.equal(app.context.cameraEndpoint('snapshot', 'front / entrance'), '/api/snapshot/front%20%2F%20entrance');
});
