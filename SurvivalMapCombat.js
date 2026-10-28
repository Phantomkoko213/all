/*:
 * @target MZ
 * @plugindesc ระบบเอาตัวรอดและต่อสู้เรียลไทม์บนแผนที่ เวอร์ชันต้นแบบ 1.0.0
 * @author Survival Map Combat Prototype
 * @help
 * ปลั๊กอินอิสระสำหรับ RPG Maker MZ
 * ปุ่ม: J โจมตี | K กดค้างเพื่อป้องกัน | L หลบ | Shift วิ่ง
 * Q/E ใช้สกิลช่อง 1/2 | F กินอาหารชิ้นแรกที่มีแท็ก <food>
 * ดูรายละเอียด Notetag และ Plugin Command ในคู่มือที่แนบมา
 *
 * @param initialHunger
 * @text ความหิวเริ่มต้น
 * @type number
 * @min 0
 * @max 100
 * @default 100
 *
 * @param initialMental
 * @text สุขภาพจิตเริ่มต้น
 * @type number
 * @min 0
 * @max 100
 * @default 100
 *
 * @param hungerPerMinute
 * @text ความหิวที่ลดต่อนาที
 * @type number
 * @decimals 2
 * @default 1.20
 *
 * @param maxStamina
 * @text พลังกายสูงสุด
 * @type number
 * @min 1
 * @default 100
 *
 * @param staminaRegen
 * @text ฟื้นพลังกายต่อวินาที
 * @type number
 * @decimals 2
 * @default 16
 *
 * @param sprintDrain
 * @text พลังกายที่ใช้ขณะวิ่งต่อวินาที
 * @type number
 * @decimals 2
 * @default 12
 *
 * @param attackDamage
 * @text ความเสียหายโจมตีปกติ
 * @type number
 * @min 1
 * @default 12
 *
 * @param attackCost
 * @text พลังกายที่ใช้โจมตี
 * @type number
 * @min 0
 * @default 10
 *
 * @param dodgeCost
 * @text พลังกายที่ใช้หลบ
 * @type number
 * @min 0
 * @default 22
 *
 * @param skill1Id
 * @text รหัสสกิลปุ่ม Q
 * @type skill
 * @default 1
 *
 * @param skill2Id
 * @text รหัสสกิลปุ่ม E
 * @type skill
 * @default 2
 *
 * @param hitAnimationId
 * @text แอนิเมชันเมื่อโดนโจมตี
 * @type animation
 * @default 1
 *
 * @param disableEncounters
 * @text ปิดการสุ่มเจอศัตรู
 * @type boolean
 * @default true
 *
 * @command AddHunger
 * @text เพิ่ม/ลดค่าความอิ่ม
 * @arg value
 * @text จำนวน (ติดลบเพื่อลด)
 * @type number
 * @min -100
 * @max 100
 * @default 20
 *
 * @command AddMental
 * @text เพิ่ม/ลดสุขภาพจิต
 * @arg value
 * @text จำนวน (ติดลบเพื่อลด)
 * @type number
 * @min -100
 * @max 100
 * @default 10
 *
 * @command AddStamina
 * @text เพิ่ม/ลดพลังกาย
 * @arg value
 * @text จำนวน (ติดลบเพื่อลด)
 * @type number
 * @min -999
 * @max 999
 * @default 20
 *
 * @command RecoverAll
 * @text ฟื้นฟูทุกระบบ
 *
 * @command DamagePlayer
 * @text สร้างความเสียหายแก่ผู้เล่น
 * @arg damage
 * @text ความเสียหาย
 * @type number
 * @min 1
 * @default 10
 * @arg mentalDamage
 * @text ผลต่อสุขภาพจิต
 * @type number
 * @min 0
 * @default 2
 */

(() => {
    "use strict";

    const pluginName = "SurvivalMapCombat";
    const params = PluginManager.parameters(pluginName);
    const P = {
        initialHunger: Number(params.initialHunger || 100),
        initialMental: Number(params.initialMental || 100),
        hungerPerMinute: Number(params.hungerPerMinute || 1.2),
        maxStamina: Number(params.maxStamina || 100),
        staminaRegen: Number(params.staminaRegen || 16),
        sprintDrain: Number(params.sprintDrain || 12),
        attackDamage: Number(params.attackDamage || 12),
        attackCost: Number(params.attackCost || 10),
        dodgeCost: Number(params.dodgeCost || 22),
        skill1Id: Number(params.skill1Id || 1),
        skill2Id: Number(params.skill2Id || 2),
        hitAnimationId: Number(params.hitAnimationId || 1),
        disableEncounters: String(params.disableEncounters) === "true"
    };

    Input.keyMapper[74] = "smcAttack"; // J
    Input.keyMapper[75] = "smcGuard";  // K
    Input.keyMapper[76] = "smcDodge";  // L
    Input.keyMapper[81] = "smcSkill1"; // Q
    Input.keyMapper[69] = "smcSkill2"; // E
    Input.keyMapper[70] = "smcEat";    // F

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const now = () => Date.now();
    const metaNumber = (object, tag, fallback = 0) => {
        if (!object || object.meta[tag] === undefined) return fallback;
        const value = Number(object.meta[tag]);
        return Number.isFinite(value) ? value : fallback;
    };

    Game_Party.prototype.smcInit = function() {
        if (this._smcHunger === undefined) this._smcHunger = P.initialHunger;
        if (this._smcMental === undefined) this._smcMental = P.initialMental;
        if (this._smcStamina === undefined) this._smcStamina = P.maxStamina;
        if (!this._smcSkillExp) this._smcSkillExp = {};
        if (!this._smcSkillLevels) this._smcSkillLevels = {};
        if (!this._smcCooldowns) this._smcCooldowns = {};
    };

    Game_Party.prototype.smcHunger = function() {
        this.smcInit();
        return this._smcHunger;
    };

    Game_Party.prototype.smcMental = function() {
        this.smcInit();
        return this._smcMental;
    };

    Game_Party.prototype.smcStamina = function() {
        this.smcInit();
        return this._smcStamina;
    };

    Game_Party.prototype.smcAddHunger = function(value) {
        this.smcInit();
        this._smcHunger = clamp(this._smcHunger + value, 0, 100);
    };

    Game_Party.prototype.smcAddMental = function(value) {
        this.smcInit();
        this._smcMental = clamp(this._smcMental + value, 0, 100);
    };

    Game_Party.prototype.smcAddStamina = function(value) {
        this.smcInit();
        this._smcStamina = clamp(this._smcStamina + value, 0, P.maxStamina);
    };

    Game_Party.prototype.smcSkillLevel = function(skillId) {
        this.smcInit();
        return this._smcSkillLevels[skillId] || 1;
    };

    Game_Party.prototype.smcGainSkillExp = function(skillId, amount) {
        this.smcInit();
        const oldLevel = this.smcSkillLevel(skillId);
        this._smcSkillExp[skillId] = (this._smcSkillExp[skillId] || 0) + amount;
        let level = oldLevel;
        while (level < 5 && this._smcSkillExp[skillId] >= level * 25) {
            this._smcSkillExp[skillId] -= level * 25;
            level++;
        }
        this._smcSkillLevels[skillId] = level;
        if (level > oldLevel && $dataSkills[skillId]) {
            $gameMessage.add($dataSkills[skillId].name + " มีความชำนาญระดับ " + level);
        }
    };

    Game_Party.prototype.smcRecoverAll = function() {
        this.smcInit();
        this._smcHunger = 100;
        this._smcMental = 100;
        this._smcStamina = P.maxStamina;
        const actor = $gameActors.actor(1);
        if (actor) actor.recoverAll();
    };

    const _Game_Player_isDashing = Game_Player.prototype.isDashing;
    Game_Player.prototype.isDashing = function() {
        if ($gameParty.smcStamina() <= 0) return false;
        return _Game_Player_isDashing.call(this);
    };

    if (P.disableEncounters) {
        Game_Player.prototype.canEncounter = function() {
            return false;
        };
    }

    function smcPlayerActor() {
        return $gameParty.leader() || $gameActors.actor(1);
    }

    function smcDistance(a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y);
    }

    function smcInFront(target, range, wide = false) {
        const player = $gamePlayer;
        const dx = target.x - player.x;
        const dy = target.y - player.y;
        if (Math.hypot(dx, dy) > range) return false;
        const facing = { 2: [0, 1], 4: [-1, 0], 6: [1, 0], 8: [0, -1] }[player.direction()];
        const dot = dx * facing[0] + dy * facing[1];
        return wide ? dot >= -0.35 : dot >= 0;
    }

    function smcAnimate(character, animationId) {
        if (animationId > 0 && $dataAnimations[animationId]) {
            $gameTemp.requestAnimation([character], animationId);
        }
    }

    function smcReadEnemy(event) {
        const data = event.event();
        if (!data || data.meta.enemy === undefined) return null;
        return {
            maxHp: metaNumber(data, "enemyHp", 30),
            damage: metaNumber(data, "enemyDamage", 7),
            sight: metaNumber(data, "sight", 6),
            range: metaNumber(data, "attackRange", 1.25),
            attackWait: metaNumber(data, "attackWait", 1100),
            exp: metaNumber(data, "exp", 8),
            mentalDamage: metaNumber(data, "mentalDamage", 2)
        };
    }

    function smcInitEnemy(event) {
        const config = smcReadEnemy(event);
        event._smcEnemyConfig = config;
        if (config && (!event._smcEnemy || event._smcEnemyHp === undefined)) {
            event._smcEnemy = true;
            event._smcEnemyHp = config.maxHp;
            event._smcNextAttack = 0;
        }
    }

    const _Game_Map_setupEvents = Game_Map.prototype.setupEvents;
    Game_Map.prototype.setupEvents = function() {
        _Game_Map_setupEvents.call(this);
        this.events().forEach(smcInitEnemy);
    };

    function smcDamageEnemy(event, baseDamage) {
        if (!event || !event._smcEnemy || event._erased) return false;
        event._smcEnemyHp -= Math.max(1, Math.round(baseDamage));
        smcAnimate(event, P.hitAnimationId);
        AudioManager.playSe({ name: "Blow1", volume: 80, pitch: 100, pan: 0 });
        if (event._smcEnemyHp <= 0) {
            const config = event._smcEnemyConfig;
            const actor = smcPlayerActor();
            if (actor) actor.gainExp(config.exp);
            $gameParty.smcAddMental(-1);
            event._erased = true;
            event.refresh();
            AudioManager.playSe({ name: "Collapse1", volume: 75, pitch: 100, pan: 0 });
        }
        return true;
    }

    function smcDamagePlayer(rawDamage, mentalDamage = 2) {
        const player = $gamePlayer;
        if (player._smcInvulnerableUntil && now() < player._smcInvulnerableUntil) return;
        const guarding = Input.isPressed("smcGuard") && $gameParty.smcStamina() > 0;
        let damage = rawDamage;
        if (guarding) {
            damage = Math.max(1, Math.round(rawDamage * 0.3));
            $gameParty.smcAddStamina(-Math.max(5, rawDamage));
            AudioManager.playSe({ name: "Equip1", volume: 75, pitch: 120, pan: 0 });
        } else {
            AudioManager.playSe({ name: "Damage1", volume: 80, pitch: 100, pan: 0 });
        }
        const actor = smcPlayerActor();
        if (!actor) return;
        actor.gainHp(-damage);
        $gameParty.smcAddMental(-(guarding ? mentalDamage * 0.25 : mentalDamage));
        smcAnimate(player, P.hitAnimationId);
        player._smcInvulnerableUntil = now() + 450;
        if (actor.isDead()) SceneManager.goto(Scene_Gameover);
    }

    function smcNormalAttack() {
        if (now() < ($gamePlayer._smcNextAttack || 0)) return;
        if ($gameParty.smcStamina() < P.attackCost) return;
        $gameParty.smcAddStamina(-P.attackCost);
        $gamePlayer._smcNextAttack = now() + 480;
        const actor = smcPlayerActor();
        const atkBonus = actor ? Math.floor(actor.atk * 0.35) : 0;
        const targets = $gameMap.events().filter(event =>
            event._smcEnemy && !event._erased && smcInFront(event, 1.5)
        );
        AudioManager.playSe({ name: "Slash1", volume: 80, pitch: 105, pan: 0 });
        targets.forEach(event => smcDamageEnemy(event, P.attackDamage + atkBonus));
        smcAnimate($gamePlayer, P.hitAnimationId);
    }

    function smcDodge() {
        const player = $gamePlayer;
        if (now() < (player._smcNextDodge || 0)) return;
        if ($gameParty.smcStamina() < P.dodgeCost || !player.canMove()) return;
        $gameParty.smcAddStamina(-P.dodgeCost);
        player._smcNextDodge = now() + 850;
        player._smcInvulnerableUntil = now() + 500;
        const d = player.direction();
        const x1 = $gameMap.roundXWithDirection(player.x, d);
        const y1 = $gameMap.roundYWithDirection(player.y, d);
        if (player.canPass(player.x, player.y, d)) {
            player.locate(x1, y1);
        }
        player.setDirection(d);
        AudioManager.playSe({ name: "Wind4", volume: 65, pitch: 130, pan: 0 });
    }

    function smcUseSkill(skillId) {
        const skill = $dataSkills[skillId];
        if (!skill) {
            $gameMessage.add("ยังไม่ได้กำหนดสกิลรหัส " + skillId);
            return;
        }
        const party = $gameParty;
        party.smcInit();
        if (now() < (party._smcCooldowns[skillId] || 0)) return;
        const cost = metaNumber(skill, "staminaCost", 20);
        if (party.smcStamina() < cost) return;
        party.smcAddStamina(-cost);
        const cooldown = metaNumber(skill, "cooldown", 4000);
        party._smcCooldowns[skillId] = now() + cooldown;
        const level = party.smcSkillLevel(skillId);
        const damage = metaNumber(skill, "mapDamage", 0) * (1 + (level - 1) * 0.12);
        const range = metaNumber(skill, "mapRange", 2);
        if (damage > 0) {
            $gameMap.events().filter(event =>
                event._smcEnemy && !event._erased && smcInFront(event, range, true)
            ).forEach(event => smcDamageEnemy(event, damage));
        }
        const actor = smcPlayerActor();
        const heal = metaNumber(skill, "heal", 0);
        if (actor && heal > 0) actor.gainHp(Math.round(heal * (1 + (level - 1) * 0.08)));
        party.smcAddMental(metaNumber(skill, "mental", 0));
        party.smcAddHunger(metaNumber(skill, "hunger", 0));
        party.smcAddStamina(metaNumber(skill, "stamina", 0));
        smcAnimate($gamePlayer, metaNumber(skill, "animationId", skill.animationId));
        AudioManager.playSe({ name: "Magic1", volume: 80, pitch: 100, pan: 0 });
        party.smcGainSkillExp(skillId, 1);
    }

    function smcEatFood() {
        const item = $dataItems.find(entry =>
            entry && entry.meta.food !== undefined && $gameParty.numItems(entry) > 0
        );
        if (!item) {
            $gameMessage.add("ไม่มีอาหารที่ใช้ได้");
            return;
        }
        $gameParty.gainItem(item, -1);
        $gameParty.smcAddHunger(metaNumber(item, "hunger", 25));
        $gameParty.smcAddMental(metaNumber(item, "mental", 0));
        $gameParty.smcAddStamina(metaNumber(item, "stamina", 0));
        const actor = smcPlayerActor();
        if (actor) actor.gainHp(metaNumber(item, "hp", 0));
        AudioManager.playSe({ name: "Recovery", volume: 75, pitch: 110, pan: 0 });
        $gameMessage.add("ใช้ " + item.name);
    }

    function smcUpdateEnemies() {
        const player = $gamePlayer;
        for (const event of $gameMap.events()) {
            if (!event._smcEnemy || event._erased || !event._smcEnemyConfig) continue;
            smcInitEnemy(event);
            const config = event._smcEnemyConfig;
            const distance = smcDistance(event, player);
            if (distance <= config.range) {
                event.turnTowardCharacter(player);
                if (now() >= event._smcNextAttack) {
                    event._smcNextAttack = now() + config.attackWait;
                    smcDamagePlayer(config.damage, config.mentalDamage);
                }
            } else if (distance <= config.sight && !event.isMoving()) {
                event.moveTowardCharacter(player);
            }
        }
    }

    function smcUpdateSurvival(dt) {
        const party = $gameParty;
        party.smcAddHunger(-P.hungerPerMinute * dt / 60);
        const hunger = party.smcHunger();
        const mental = party.smcMental();
        if (hunger <= 0) {
            party.smcAddMental(-0.35 * dt);
            const actor = smcPlayerActor();
            if (actor) actor.gainHp(-0.7 * dt);
            if (actor && actor.isDead()) SceneManager.goto(Scene_Gameover);
        } else if (hunger < 25) {
            party.smcAddMental(-0.04 * dt);
        }
        let regen = P.staminaRegen;
        if (hunger < 25) regen *= 0.5;
        if (mental < 30) regen *= 0.65;
        if (Input.isPressed("smcGuard")) regen *= 0.25;
        if ($gamePlayer.isDashing() && $gamePlayer.isMoving()) {
            party.smcAddStamina(-P.sprintDrain * dt);
        } else {
            party.smcAddStamina(regen * dt);
        }
    }

    class Window_SurvivalHud extends Window_Base {
        initialize() {
            super.initialize(new Rectangle(8, 8, 390, 244));
            this.opacity = 185;
            this.contents.fontSize = $gameSystem.mainFontSize() - 7;
            this.refresh();
        }

        gaugeColor(value) {
            if (value < 25) return "#e85d68";
            if (value < 55) return "#e5b95c";
            return "#78c88b";
        }

        drawBar(label, value, max, y, color) {
            const x = 12;
            const width = 230;
            const height = 12;
            const ratio = clamp(value / max, 0, 1);
            this.contents.fillRect(x, y + 6, width, height, "#252a32");
            this.contents.fillRect(x + 1, y + 7, (width - 2) * ratio, height - 2, color);
            this.changeTextColor("#ffffff");
            this.drawText(label, x, y - 8, 100, "left");
            this.drawText(Math.ceil(value) + "/" + max, x + 120, y - 8, 110, "right");
        }

        refresh() {
            this.contents.clear();
            const actor = smcPlayerActor();
            if (!actor) return;
            this.changeTextColor("#ffffff");
            this.drawText(actor.name(), 12, 0, 250, "left");
            this.drawBar("HP", actor.hp, actor.mhp, 30, "#d96975");
            this.drawBar("พลังกาย", $gameParty.smcStamina(), P.maxStamina, 62, "#63b8d4");
            this.drawBar("อิ่ม", $gameParty.smcHunger(), 100, 94, this.gaugeColor($gameParty.smcHunger()));
            this.drawBar("จิตใจ", $gameParty.smcMental(), 100, 126, this.gaugeColor($gameParty.smcMental()));
            this.changeTextColor("#e7e7e7");
            const skillText = (id, key, y) => {
                const skill = $dataSkills[id];
                if (!skill) return;
                const remain = Math.max(0, (($gameParty._smcCooldowns[id] || 0) - now()) / 1000);
                const cd = remain > 0 ? " " + remain.toFixed(1) + "s" : " พร้อม";
                this.drawText(key + ": " + skill.name + " Lv." + $gameParty.smcSkillLevel(id) + cd, 12, y, 350, "left");
            };
            skillText(P.skill1Id, "Q", 160);
            skillText(P.skill2Id, "E", 188);
        }
    }

    const _Scene_Map_createAllWindows = Scene_Map.prototype.createAllWindows;
    Scene_Map.prototype.createAllWindows = function() {
        _Scene_Map_createAllWindows.call(this);
        this._smcHud = new Window_SurvivalHud();
        this.addWindow(this._smcHud);
    };

    const _Scene_Map_update = Scene_Map.prototype.update;
    Scene_Map.prototype.update = function() {
        _Scene_Map_update.call(this);
        const time = now();
        const dt = Math.min(0.1, (time - (this._smcLastTime || time)) / 1000);
        this._smcLastTime = time;
        if (!this.isBusy() && !$gameMap.isEventRunning()) {
            $gameParty.smcInit();
            smcUpdateSurvival(dt);
            smcUpdateEnemies();
            if ($gamePlayer.canMove()) {
                if (Input.isTriggered("smcAttack")) smcNormalAttack();
                if (Input.isTriggered("smcDodge")) smcDodge();
                if (Input.isTriggered("smcSkill1")) smcUseSkill(P.skill1Id);
                if (Input.isTriggered("smcSkill2")) smcUseSkill(P.skill2Id);
                if (Input.isTriggered("smcEat")) smcEatFood();
            }
        }
        if (this._smcHud) {
            this._smcHud.visible = !$gameMessage.isBusy();
            if (Graphics.frameCount % 5 === 0) this._smcHud.refresh();
        }
    };

    PluginManager.registerCommand(pluginName, "AddHunger", args => {
        $gameParty.smcAddHunger(Number(args.value || 0));
    });
    PluginManager.registerCommand(pluginName, "AddMental", args => {
        $gameParty.smcAddMental(Number(args.value || 0));
    });
    PluginManager.registerCommand(pluginName, "AddStamina", args => {
        $gameParty.smcAddStamina(Number(args.value || 0));
    });
    PluginManager.registerCommand(pluginName, "RecoverAll", () => {
        $gameParty.smcRecoverAll();
    });
    PluginManager.registerCommand(pluginName, "DamagePlayer", args => {
        smcDamagePlayer(Number(args.damage || 1), Number(args.mentalDamage || 0));
    });
})();