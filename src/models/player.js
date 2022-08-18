const { Profile } = require('./profile.js');
class Player {
  #username;
  #color;
  #profession;
  #role;
  #profile;
  #isRolledDice;
  #currentPosition;
  constructor(username, role) {
    this.#username = username;
    this.#role = role;
    this.#color = null;
    this.#profession = null;
    this.#profile = null;
    this.#isRolledDice = false;
    this.#currentPosition = 0;
  }

  set rolledDice(status) {
    this.#isRolledDice = status;
  }

  assignColor(color) {
    this.#color = color;
  }

  assignProfession(profession) {
    this.#profession = profession;
  }

  createProfile() {
    this.#profile = new Profile(this.#profession);
    this.#profile.setDefaults();
  }

  payday() {
    this.#profile.addPay();
  }

  canContinue() {
    return this.#profile.details.cash > 0;
  }

  doodad(cost) {
    return this.#profile.deductDoodad(cost);
  }

  buyRealEstate(card) {
    return this.#profile.addAsset(card);
  }

  charity(amount) {
    return this.#profile.donateCash(amount);
  }

  move(steps) {
    this.#currentPosition = (this.#currentPosition + steps) % 24;
    if (this.#currentPosition === 0) {
      this.#currentPosition = 24;
    }
  }

  get details() {
    return {
      username: this.#username,
      role: this.#role,
      color: this.#color,
      profession: this.#profession,
      profile: this.#profile.details,
      isRolledDice: this.#isRolledDice,
      currentPosition: this.#currentPosition
    };
  }
}

module.exports = { Player };
