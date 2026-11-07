<template>
  <div class="rgb-picker">
    <button ref="trigger" type="button" class="picker-trigger" :aria-expanded="open" aria-controls="accent-rgb-panel" @click="toggle"><span class="trigger-swatch" :style="{ background: modelValue }" />自定义颜色<Icon :icon="open ? 'mdi:chevron-up' : 'mdi:chevron-down'" /></button>
    <Teleport to="body">
      <div v-if="open" class="picker-dismiss" @pointerdown="close" />
      <section v-if="open" id="accent-rgb-panel" ref="panel" class="picker-panel" :data-theme="theme" :style="[position, accentTokens(modelValue)]" role="dialog" aria-label="自定义颜色" @keydown.esc.stop.prevent="close">
        <header>自定义颜色<button type="button" aria-label="关闭调色板" @click="close"><Icon icon="mdi:close" /></button></header>
        <div ref="palette" class="color-palette" :style="{ backgroundColor: `hsl(${hue}, 100%, 50%)` }" tabindex="0" role="slider" aria-label="饱和度与明度" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="Math.round(saturation * 100)" :aria-valuetext="`饱和度 ${Math.round(saturation * 100)}%，明度 ${Math.round(value * 100)}%`" @pointerdown="startPalette" @pointermove="movePalette" @pointerup="endPalette" @pointercancel="endPalette" @keydown="paletteKey"><span class="palette-cursor" :style="{ left: `${saturation * 100}%`, top: `${(1 - value) * 100}%`, background: modelValue }" /></div>
        <div class="hue-row"><span class="preview-swatch" :style="{ background: modelValue }" /><input class="hue-strip" type="range" min="0" max="360" :value="hue" aria-label="色相" @input="changeHue" /></div>
        <div class="rgb-values"><label v-for="(channel, index) in channels" :key="channel.key"><span>{{ channel.key }}</span><input type="number" min="0" max="255" step="1" :value="rgb[index]" :aria-label="`${channel.name}通道色值`" @change="updateChannel(index, $event)" @blur="updateChannel(index, $event)" @keydown.enter.prevent="updateChannel(index, $event)" /></label></div>
        <p>在色板上选取颜色，或输入 RGB 色值</p>
      </section>
    </Teleport>
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { accentTokens } from '../styles/accent';
const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ 'update:modelValue': [color: string] }>();
const open = ref(false);
const theme = ref('dark');
const trigger = ref<HTMLButtonElement>();
const panel = ref<HTMLElement>();
const palette = ref<HTMLElement>();
const position = ref({ left: '0px', top: '0px' });
const hue = ref(0), saturation = ref(0), value = ref(0);
let dragging: number | null = null;
const channels = [{ key: 'R', name: '红色' }, { key: 'G', name: '绿色' }, { key: 'B', name: '蓝色' }];
const rgb = computed(() => [1, 3, 5].map(offset => parseInt(props.modelValue.slice(offset, offset + 2), 16)));
watch(rgb, ([red, green, blue]) => {
  const [r, g, b] = [red / 255, green / 255, blue / 255];
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  value.value = max; saturation.value = max ? delta / max : 0;
  if (delta) hue.value = ((max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * 60 + 360) % 360;
}, { immediate: true });
function emitRgb(next: number[]) { emit('update:modelValue', '#' + next.map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('')); }
function emitHsv() {
  const h = hue.value / 60, c = value.value * saturation.value, x = c * (1 - Math.abs(h % 2 - 1)), m = value.value - c;
  const components = [[c,x,0],[x,c,0],[0,c,x],[0,x,c],[x,0,c],[c,0,x]][Math.floor(h) % 6];
  emitRgb(components.map(component => (component + m) * 255));
}
function locate() {
  if (!trigger.value || !panel.value) return;
  const rect = trigger.value.getBoundingClientRect(), width = panel.value.offsetWidth, height = panel.value.offsetHeight;
  position.value = { left: `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`, top: `${rect.bottom + 8 + height <= window.innerHeight - 12 ? rect.bottom + 8 : Math.max(12, rect.top - height - 8)}px` };
}
async function toggle() {
  if (open.value) return close();
  theme.value = trigger.value?.closest('[data-theme]')?.getAttribute('data-theme') || 'dark';
  open.value = true; await nextTick(); locate(); palette.value?.focus({ preventScroll: true });
  window.addEventListener('resize', locate); window.addEventListener('scroll', locate, true); document.addEventListener('keydown', escape);
}
function removeListeners() { window.removeEventListener('resize', locate); window.removeEventListener('scroll', locate, true); document.removeEventListener('keydown', escape); }
function close() { open.value = false; dragging = null; removeListeners(); trigger.value?.focus({ preventScroll: true }); }
function escape(event: KeyboardEvent) { if (event.key === 'Escape') close(); }
onBeforeUnmount(removeListeners);
function selectPalette(event: PointerEvent) {
  const rect = palette.value!.getBoundingClientRect();
  saturation.value = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  value.value = 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)); emitHsv();
}
function startPalette(event: PointerEvent) { if (event.button !== 0) return; dragging = event.pointerId; palette.value?.setPointerCapture(event.pointerId); palette.value?.focus({ preventScroll: true }); selectPalette(event); }
function movePalette(event: PointerEvent) { if (dragging === event.pointerId) selectPalette(event); }
function endPalette(event: PointerEvent) { if (dragging !== event.pointerId) return; if (palette.value?.hasPointerCapture(event.pointerId)) palette.value.releasePointerCapture(event.pointerId); dragging = null; }
function paletteKey(event: KeyboardEvent) {
  if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
  event.preventDefault(); const step = event.shiftKey ? .1 : .01;
  saturation.value = Math.max(0, Math.min(1, saturation.value + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0)));
  value.value = Math.max(0, Math.min(1, value.value + (event.key === 'ArrowUp' ? step : event.key === 'ArrowDown' ? -step : 0))); emitHsv();
}
function changeHue(event: Event) { hue.value = Number((event.target as HTMLInputElement).value); emitHsv(); }
function updateChannel(index: number, event: Event) {
  const input = event.target as HTMLInputElement;
  if (!input.value.trim() || !Number.isFinite(Number(input.value))) { input.value = String(rgb.value[index]); return; }
  const next = [...rgb.value]; next[index] = Math.max(0, Math.min(255, Math.round(Number(input.value)))); input.value = String(next[index]); emitRgb(next);
}
</script>
<style scoped lang="scss">
.rgb-picker { width: 100%; }
.picker-trigger { display: inline-flex; align-items: center; gap: 10px; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: var(--hover-bg); color: var(--text-primary); font-size: 13px; cursor: pointer; }
.picker-trigger:hover { border-color: var(--color-primary); }
.picker-trigger > svg { color: var(--text-secondary); font-size: 18px; }
.trigger-swatch { width: 24px; height: 24px; border: 1px solid var(--border-color); border-radius: 6px; }
.picker-dismiss { position: fixed; inset: 0; z-index: 149; }
.picker-panel { position: fixed; z-index: 150; width: min(320px, calc(100vw - 24px)); box-sizing: border-box; max-height: calc(100dvh - 24px); overflow-y: auto; padding: 18px; border: 1px solid var(--border-color); border-radius: 16px; background: var(--bg-secondary); color: var(--text-primary); box-shadow: 0 16px 48px rgba(0,0,0,.24), 0 2px 8px rgba(0,0,0,.12); }
.picker-panel header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; font-size: 14px; font-weight: 600; }
.picker-panel header button { display: grid; place-items: center; width: 26px; height: 26px; border: 0; border-radius: 6px; background: transparent; color: var(--text-secondary); font-size: 18px; cursor: pointer; }
.picker-panel header button:hover { background: var(--hover-bg); }
.color-palette { position: relative; height: 180px; border-radius: 9px; background-image: linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent); cursor: crosshair; touch-action: none; }
.palette-cursor { position: absolute; width: 16px; height: 16px; box-sizing: border-box; border: 2px solid #fff; border-radius: 50%; transform: translate(-50%,-50%); box-shadow: 0 0 0 1px rgba(0,0,0,.45), 0 1px 4px rgba(0,0,0,.3); pointer-events: none; }
.hue-row { display: flex; align-items: center; gap: 12px; margin: 18px 0; }
.preview-swatch { flex-shrink: 0; width: 28px; height: 28px; border-radius: 8px; border: 1px solid var(--border-color); }
.hue-strip { appearance: none; min-width: 0; width: 100%; height: 12px; border-radius: 999px; background: linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00); cursor: pointer; }
.hue-strip::-webkit-slider-thumb { appearance: none; width: 16px; height: 20px; border: 2px solid white; border-radius: 6px; background: transparent; box-shadow: 0 0 0 1px rgba(0,0,0,.35); }
.hue-strip::-moz-range-thumb { width: 12px; height: 16px; border: 2px solid white; border-radius: 6px; background: transparent; box-shadow: 0 0 0 1px rgba(0,0,0,.35); }
.rgb-values { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10px; }
.rgb-values label { display: flex; flex-direction: column; gap: 6px; text-align: center; font-size: 11px; color: var(--text-secondary); }
.rgb-values input { width: 100%; box-sizing: border-box; padding: 8px; text-align: center; border: 1px solid var(--border-color); border-radius: 7px; background: var(--bg-primary); color: var(--text-primary); font: 13px var(--font-mono); appearance: textfield; }
.rgb-values input::-webkit-inner-spin-button, .rgb-values input::-webkit-outer-spin-button { appearance: none; margin: 0; }
.picker-panel :focus-visible, .picker-trigger:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 3px; }
.picker-panel p { margin: 14px 0 0; color: var(--text-tertiary); font-size: 11px; text-align: center; }
</style>
