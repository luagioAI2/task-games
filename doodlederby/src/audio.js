export class DerbySound {
  constructor(){this._muted=false;this.lastBeat=-1;this.serial=0;this.sound=null;this.started=false;this.starting=null;}
  init(ready){this.ready=ready.then(sound=>{this.sound=sound;sound.settings.setMuted(this._muted);void sound.preload('gameplay');return sound;}).catch(error=>{console.warn('Sound unavailable',error);return null;});}
  get muted(){return this._muted;}
  set muted(value){const was=this._muted;this._muted=!!value;this.sound?.settings.setMuted(this._muted);if(was&&!this._muted&&this.started)void this.sound?.startMusic('music.doodle',{crossfadeMs:150});}
  async unlock(){const sound=this.sound||await this.ready;if(!sound)return;await sound.unlock();if(!this.started&&!this.starting){this.starting=sound.setMusicState('doodle').then(()=>{this.started=true;}).finally(()=>{this.starting=null;});}await this.starting;}
  play(kind){
    const sound=this.sound;if(!sound||!this.started)return;const options={eventId:`doodle:${++this.serial}`};
    if(kind==='hit')void sound.playCue('sfx.hit',options);
    if(kind==='miss'||kind==='stumble')void sound.playCue('sfx.miss',options);
    if(kind==='jump')void sound.playCue('sfx.jump',options);
    if(kind==='go')void sound.playCue('sfx.go',options);
    if(kind==='finish')void sound.playCue('sfx.finish',options);
    if(kind==='count')void sound.playCue('sfx.count',options);
    if(kind==='beat')void sound.playCue('sfx.tap',options);
  }
  update(race){if(!race.running)return;const beat=Math.floor((race.time-.64)/.8);if(beat!==this.lastBeat){this.lastBeat=beat;this.play('beat');}}
  clear(){this.lastBeat=-1;}
  dispose(){void this.sound?.dispose();}
}
