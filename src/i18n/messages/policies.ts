/** The site's policies: their public pages, the links to them, and the admin's editor. */
const en = {
  policies: {
    names: {
      privacy: 'Privacy Policy',
      terms: 'Terms of Use',
      cookies: 'Cookie Policy',
    },
    // In the sign-in pages' footer, beside the copyright.
    short: {
      privacy: 'Privacy',
      terms: 'Terms',
      cookies: 'Cookies',
    },
    nav: 'Policies',
    read: 'Viewed {pct}%',
    leads: {
      privacy: 'What Helpic keeps about you, why, and how you stay in control.',
      terms: 'The rules for using Helpic, for freelancers and their clients.',
      cookies: 'The few cookies Helpic needs to keep you signed in, and nothing more.',
    },
    updated: 'Updated {date}',
    loadFailed: "Couldn't load this page. Try again in a moment.",
    retry: 'Try again',
    // {terms} and {privacy} are links.
    agree: 'By creating an account, you agree to the {terms} and the {privacy}.',
    agreeTerms: 'Terms of Use',
    agreePrivacy: 'Privacy Policy',
    cookiesMore: 'Learn more',
  },
  policyAdmin: {
    description: "The privacy policy, terms of use and cookie policy anyone can read. Until you edit one, Helpic's own text is shown.",
    language: 'Language',
    edited: 'Edited by {who}, {when}',
    editedSomeone: 'Edited {when}',
    text: 'Code',
    preview: 'Preview',
    format: 'A line starting with "## " is a heading, "- " a list item; an empty line separates paragraphs.',
    unsaved: 'Unsaved changes',
    open: 'Open the page',
    save: 'Save',
    saved: 'Saved: readers see the new text',
    saveFailed: "Couldn't save the policy",
    reset: 'Restore default',
    resetTitle: 'Restore the default text?',
    resetText: "Your text for this policy in this language will be replaced with Helpic's own.",
    resetDone: 'The default text is back',
    resetFailed: "Couldn't restore the default text",
  },
}

const uk: typeof en = {
  policies: {
    names: {
      privacy: 'Політика конфіденційності',
      terms: 'Умови користування',
      cookies: 'Політика щодо cookie',
    },
    short: {
      privacy: 'Конфіденційність',
      terms: 'Умови',
      cookies: 'Cookie',
    },
    nav: 'Політики',
    read: 'Переглянуто {pct}%',
    leads: {
      privacy: 'Що Helpic зберігає про вас, навіщо і як ви цим керуєте.',
      terms: 'Правила користування Helpic для фрилансерів та їхніх замовників.',
      cookies: 'Кілька cookie, без яких Helpic не втримає вас у системі, і нічого більше.',
    },
    updated: 'Оновлено {date}',
    loadFailed: 'Не вдалося завантажити сторінку. Спробуйте за мить.',
    retry: 'Спробувати ще',
    agree: 'Створюючи акаунт, ви погоджуєтеся з {terms} та {privacy}.',
    agreeTerms: 'Умовами користування',
    agreePrivacy: 'Політикою конфіденційності',
    cookiesMore: 'Детальніше',
  },
  policyAdmin: {
    description: 'Політика конфіденційності, умови користування і політика щодо cookie, які може прочитати будь-хто. Поки ви не змінили текст, показується стандартний текст Helpic.',
    language: 'Мова',
    edited: 'Змінено: {who}, {when}',
    editedSomeone: 'Змінено {when}',
    text: 'Код',
    preview: 'Попередній перегляд',
    format: 'Рядок, що починається з "## ", — заголовок, з "- " — пункт списку; порожній рядок розділяє абзаци.',
    unsaved: 'Незбережені зміни',
    open: 'Відкрити сторінку',
    save: 'Зберегти',
    saved: 'Збережено: читачі вже бачать новий текст',
    saveFailed: 'Не вдалося зберегти політику',
    reset: 'Повернути стандартний',
    resetTitle: 'Повернути стандартний текст?',
    resetText: 'Ваш текст цієї політики цією мовою заміниться стандартним текстом Helpic.',
    resetDone: 'Стандартний текст повернуто',
    resetFailed: 'Не вдалося повернути стандартний текст',
  },
}

export default { en, uk }
