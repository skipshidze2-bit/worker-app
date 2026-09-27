import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { setConfirmLabels } from '@/lib/confirm';
import { setFormatLocale } from '@/lib/format';

// App text in Georgian (default for the Tbilisi launch) and English.
// Keys are grouped by screen. `{name}` placeholders are filled by t().

const en = {
  // common
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.save': 'Save',
  'common.back': 'Back',
  'common.new': 'New',
  'common.urgent': 'Urgent',
  'common.upcoming': 'Upcoming',
  'common.past': 'Past',
  'common.chat': 'Chat',
  'common.cancel': 'Cancel',
  'common.shifts': '{count} shifts',
  'common.hoursTotal': '{hours}h · {amount} total',

  // categories (stored in English in the database)
  'cat.Waiter': 'Waiter',
  'cat.Kitchen': 'Kitchen',
  'cat.Bartender': 'Bartender',
  'cat.Cleaner': 'Cleaner',
  'cat.Mover': 'Mover',
  'cat.Warehouse': 'Warehouse',
  'cat.Events': 'Events',
  'cat.Retail': 'Retail',

  // booking statuses
  'status.pending_payment': 'Processing',
  'status.claimed': 'Booked',
  'status.checked_in': 'Checked in',
  'status.checked_out': 'Waiting for hours confirmation',
  'status.confirmed': 'Hours confirmed, payment on the way',
  'status.paid': 'Paid',
  'status.no_show': 'No-show',
  'status.cancelled_by_worker': 'Cancelled by worker',
  'status.cancelled_by_employer': 'Cancelled by employer',
  'status.disputed': 'In dispute',
  'shiftStatus.open': 'Open',
  'shiftStatus.filled': 'Filled',
  'shiftStatus.completed': 'Completed',
  'shiftStatus.cancelled': 'Cancelled',

  // navigation
  'nav.findShifts': 'Find shifts',
  'nav.myShifts': 'My shifts',
  'nav.earnings': 'Earnings',
  'nav.profile': 'Profile',
  'nav.postShift': 'Post a shift',
  'nav.myWorkers': 'My workers',
  'nav.account': 'Account',
  'nav.createProfile': 'Create your profile',
  'nav.yourShift': 'Your shift',
  'nav.shift': 'Shift',
  'nav.payments': 'Payments',
  'nav.editProfile': 'Edit profile',

  // sign-in
  'signIn.title': 'Day shifts, paid next day',
  'signIn.subtitle': 'Find one-day work nearby, or staff your business by tomorrow.',
  'signIn.phone': 'Phone number',
  'signIn.sendCode': 'Send code',
  'signIn.codeSent': 'We sent a code to {phone}.',
  'signIn.code': 'Code',
  'signIn.continue': 'Continue',
  'signIn.otherNumber': 'Use a different number',

  // onboarding
  'onb.howUse': 'How will you use the app?',
  'onb.work': 'I want to work',
  'onb.workSub': 'Pick up one-day shifts near you. Free, and paid the next day.',
  'onb.hire': 'I need staff',
  'onb.hireSub': "Post a shift and get verified workers, with a replacement if anyone doesn't show.",
  'onb.fullName': 'Your full name',
  'onb.skills': 'What work can you do?',
  'onb.areas': 'Areas you can work in',
  'onb.areasPh': 'Vake, Saburtalo, Old Tbilisi',
  'onb.languages': 'Languages',
  'onb.languagesPh': 'Georgian, English, Russian',
  'onb.verify': 'Verify your identity',
  'onb.verifySub': 'Employers only see verified workers. Your photos are private and only seen by our team.',
  'onb.idPhoto': 'Photo of your ID',
  'onb.idDone': 'ID photo ✓',
  'onb.selfie': 'Take a selfie',
  'onb.selfieDone': 'Selfie ✓',
  'onb.business': 'Business name',
  'onb.legalId': 'Company ID number (optional)',
  'onb.terms': 'By continuing you agree to the terms, including arranging all shifts with people you meet here through the app.',
  'onb.create': 'Create profile',

  // worker feed
  'feed.idPending': "We're checking your ID",
  'feed.idPendingSub': "You can browse shifts now and claim them once you're verified, usually within a day.",
  'feed.suspended': 'Your account is suspended',
  'feed.suspendedSub': 'This happens after 3 strikes (no-shows or late cancellations). Contact support to appeal.',
  'feed.setupPayouts': 'Add your bank account',
  'feed.setupPayoutsSub': 'Add your IBAN so you get paid after each shift.',
  'feed.empty': 'No open shifts right now. Pull down to refresh.',

  // my shifts / earnings
  'my.empty': 'No upcoming shifts. Find one in the shift feed.',
  'earn.paidOut': 'Paid out',
  'earn.onTheWay': 'On the way',
  'earn.explain':
    "Pay goes to your bank account by the next working day after the employer confirms your hours. If they don't, your hours are confirmed automatically 24 hours after you check out.",
  'earn.paid': 'Paid',
  'earn.lateCancel': ' · late cancellation pay',
  'earn.empty': 'Your earnings will show here after your first shift.',

  // shift detail (worker)
  'shift.gone': 'This shift is no longer available.',
  'shift.youEarn': 'You earn',
  'shift.payExplain': '{rate}/h × {hours}h. Paid to your bank after the shift. No fees for you.',
  'shift.addressLater': 'The exact address and instructions are shown after you book.',
  'shift.viewBooking': 'View your booking',
  'shift.claim': 'Claim shift',
  'shift.claimTitle': 'Claim this shift?',
  'shift.claimBody': 'Cancelling less than 24 hours before the start counts as a strike. 3 strikes suspend your account.',
  'shift.blockedSuspended': 'Your account is suspended.',
  'shift.blockedId': 'You can claim shifts once your ID is verified.',

  // shift detail (employer)
  'emp.booked': '{n}/{total} booked',
  'emp.whoComing': "Who's coming",
  'emp.nobody': "Nobody has booked yet. We'll notify you when someone does.",
  'emp.workedBefore': ' · worked with you before',
  'emp.charged': 'Charged {total} (wage {wage} + fee {fee})',
  'emp.favorite': '☆ Favorite',
  'emp.favorited': '★ Favorite',
  'emp.cancelWorker': 'Cancel {name}?',
  'emp.cancelLate': 'The shift starts within 24 hours, so the worker will still receive half of their wage.',
  'emp.cancelEarly': 'You will get a full refund.',
  'emp.cancelShift': 'Cancel this shift',
  'emp.cancelShiftTitle': 'Cancel this shift?',
  'emp.cancelShiftBody': 'It will be removed from the shift feed.',
  'emp.hoursWorked': 'Hours worked',
  'emp.hoursHint':
    "From check-in and check-out. If you don't confirm within 24 hours after check-out, these hours are confirmed automatically.",
  'emp.confirmHours': 'Confirm hours',
  'emp.postShift': 'Post a shift',
  'emp.noUpcoming': 'No upcoming shifts.',

  // favorites
  'fav.explain': "Workers you've favorited get your new shifts first, and you pay a lower fee when they work for you again.",
  'fav.remove': 'Remove',
  'fav.empty': 'Tap “Favorite” on a worker after a shift to add them here.',
  'fav.rebook': 'Rebook: post a shift for favorites',

  // post a shift
  'post.cardFirst': 'Add a payment card first',
  'post.cardFirstSub':
    "You're only charged when a worker books your shift. The money is held until the shift is done, and refunded if nobody shows up.",
  'post.addCard': 'Add a card',
  'post.type': 'Type of work',
  'post.title': 'Job title (optional)',
  'post.titlePh': 'e.g. Waiter for a wedding',
  'post.date': 'Date',
  'post.start': 'Start',
  'post.end': 'End',
  'post.workers': 'Workers needed',
  'post.rate': 'Pay per hour (₾)',
  'post.area': 'Area (shown publicly)',
  'post.areaPh': 'e.g. Vake',
  'post.address': 'Exact address',
  'post.addressPh': 'Street, number',
  'post.addressHint': 'Only shown to workers after they book.',
  'post.useLocation': 'Use my current location',
  'post.pinned': 'Job site pinned ✓',
  'post.description': 'What the job involves',
  'post.instructions': 'Instructions for booked workers',
  'post.instructionsPh': 'Dress code, who to ask for, entrance',
  'post.favoritesFirst': 'Offer to my favorite workers first ({hours}h head start)',
  'post.total': 'Total price',
  'post.breakdown': 'Wages {wage} + service fee {fee} ({pct}%)',
  'post.repeatNote': 'Repeat workers and favorites cost {repeat}% instead of {first}%, so the final price may be lower.',
  'post.urgentNote': 'Includes a {pct}% urgent-fill surcharge for shifts starting within 24 hours.',
  'post.enterDetails': 'Enter the date, times and pay to see the price.',
  'post.submit': 'Post shift',
  'post.locationNeeded': 'Location permission is needed to pin the job site.',
  'post.addressNotFound': "We couldn't find that address. Try “Use my current location” at the job site.",

  // booking (worker)
  'book.openMaps': 'Open in maps',
  'book.arrive': 'When you arrive',
  'book.arriveSub': 'Check in at the job site. It opens 30 minutes before the start and uses your location.',
  'book.checkIn': 'Check in',
  'book.checkedInAt': 'Checked in at {time}.',
  'book.checkOut': 'Check out',
  'book.checkOutTitle': 'Check out?',
  'book.checkOutBody': 'Your hours are counted until now.',
  'book.checkedOut':
    "Checked out at {time}. The employer has 24 hours to confirm your hours, then they're confirmed automatically and you're paid.",
  'book.message': 'Message the employer',
  'book.cancel': 'Cancel shift',
  'book.cancelTitle': 'Cancel this shift?',
  'book.cancelLate': 'The shift starts within 24 hours, so cancelling now gives you a strike. 3 strikes suspend your account.',
  'book.cancelEarly': 'You can cancel for free because the shift is more than 24 hours away.',
  'book.locationNeeded': 'Location is needed to check in at the job site.',
  'book.theEmployer': 'the employer',

  // chat
  'chat.safety': 'For your safety, phone numbers and other contact details are hidden. Chat closes after the shift is paid.',
  'chat.placeholder': 'Message',
  'chat.send': 'Send',
  'chat.hidden': ' · contact details hidden',
  'chat.warnTitle': 'Contact details will be hidden',
  'chat.warnBody':
    'Phone numbers, emails and social handles are hidden in chat. Keep everything in the app: that is how pay is guaranteed and no-shows are replaced. Send anyway?',

  // rating
  'rate.title': 'Rate {name}',
  'rate.comment': 'Comment (optional)',
  'rate.submit': 'Submit rating',

  // profile
  'prof.idVerified': 'ID verified',
  'prof.idPending': 'ID check pending',
  'prof.idRejected': 'ID rejected',
  'prof.strikes': '{n}/3 strikes',
  'prof.areas': 'Areas: {list}',
  'prof.languages': 'Languages: {list}',
  'prof.privacyWorker': 'Your phone number is never shown to employers. Chat goes through the app.',
  'prof.privacyEmployer': 'Your phone number is never shown to workers. Chat goes through the app.',
  'prof.edit': 'Edit profile',
  'prof.payoutsSet': 'Bank account: added',
  'prof.payoutsAdd': 'Add your bank account',
  'prof.cardSaved': 'Payment card: saved',
  'prof.cardAdd': 'Add a payment card',
  'prof.language': 'Language: English',
  'prof.signOut': 'Sign out',
  'edit.fullName': 'Full name',
  'edit.about': 'About you',
  'edit.aboutHint': "Don't include phone numbers or social handles.",
  'edit.skills': 'Skills',
  'edit.areas': 'Areas',

  // payments
  'pay.cardSaved': 'Card saved {mask}',
  'pay.addCard': 'Add a payment card',
  'pay.cardExplain':
    "Each time a worker books your shift we charge the wage plus our fee and hold it until the shift is done. If they don't show up, you're refunded and we look for a replacement.",
  'pay.replaceCard': 'Replace card',
  'pay.addCardButton': 'Add card',
  'pay.cardPending': 'If you finished adding the card, it will show here in a few seconds.',
  'pay.payoutsSet': 'Your bank account is added',
  'pay.payoutsAsk': 'Where should we send your pay?',
  'pay.payoutsExplain':
    'Employers pay upfront, so your pay is guaranteed. It reaches your bank account by the next working day after your hours are confirmed. We never take a cut of your wage.',
  'pay.iban': 'Your bank account (IBAN)',
  'pay.ibanHint': 'Find it in your bank app (TBC, Bank of Georgia, Liberty…). It must be in your own name.',
  'pay.ibanInvalid': "That doesn't look like a Georgian IBAN yet.",
  'pay.saved': 'Saved.',
};

export type TKey = keyof typeof en;

const ka: Record<TKey, string> = {
  'common.yes': 'კი',
  'common.no': 'არა',
  'common.save': 'შენახვა',
  'common.back': 'უკან',
  'common.new': 'ახალი',
  'common.urgent': 'სასწრაფო',
  'common.upcoming': 'მომავალი',
  'common.past': 'წარსული',
  'common.chat': 'ჩატი',
  'common.cancel': 'გაუქმება',
  'common.shifts': '{count} ცვლა',
  'common.hoursTotal': '{hours} სთ · სულ {amount}',

  'cat.Waiter': 'მიმტანი',
  'cat.Kitchen': 'სამზარეულო',
  'cat.Bartender': 'ბარმენი',
  'cat.Cleaner': 'დამლაგებელი',
  'cat.Mover': 'მტვირთავი',
  'cat.Warehouse': 'საწყობი',
  'cat.Events': 'ღონისძიებები',
  'cat.Retail': 'მაღაზია',

  'status.pending_payment': 'მუშავდება',
  'status.claimed': 'დაჯავშნილი',
  'status.checked_in': 'მოსული',
  'status.checked_out': 'საათების დადასტურებას ელოდება',
  'status.confirmed': 'საათები დადასტურდა, ანაზღაურება გზაშია',
  'status.paid': 'გადახდილი',
  'status.no_show': 'არ გამოცხადდა',
  'status.cancelled_by_worker': 'გააუქმა მუშაკმა',
  'status.cancelled_by_employer': 'გააუქმა დამსაქმებელმა',
  'status.disputed': 'სადავო',
  'shiftStatus.open': 'ღია',
  'shiftStatus.filled': 'შევსებული',
  'shiftStatus.completed': 'დასრულებული',
  'shiftStatus.cancelled': 'გაუქმებული',

  'nav.findShifts': 'ცვლები',
  'nav.myShifts': 'ჩემი ცვლები',
  'nav.earnings': 'შემოსავალი',
  'nav.profile': 'პროფილი',
  'nav.postShift': 'ცვლის დამატება',
  'nav.myWorkers': 'ჩემი მუშაკები',
  'nav.account': 'ანგარიში',
  'nav.createProfile': 'შექმენი პროფილი',
  'nav.yourShift': 'შენი ცვლა',
  'nav.shift': 'ცვლა',
  'nav.payments': 'გადახდები',
  'nav.editProfile': 'პროფილის რედაქტირება',

  'signIn.title': 'ერთდღიანი სამუშაო, ანაზღაურება მეორე დღეს',
  'signIn.subtitle': 'იპოვე სამუშაო ახლოს, ან დაიქირავე თანამშრომლები ხვალისთვის.',
  'signIn.phone': 'ტელეფონის ნომერი',
  'signIn.sendCode': 'კოდის გაგზავნა',
  'signIn.codeSent': 'კოდი გაიგზავნა ნომერზე {phone}.',
  'signIn.code': 'კოდი',
  'signIn.continue': 'გაგრძელება',
  'signIn.otherNumber': 'სხვა ნომრის გამოყენება',

  'onb.howUse': 'როგორ გამოიყენებ აპლიკაციას?',
  'onb.work': 'მინდა ვიმუშაო',
  'onb.workSub': 'აიღე ერთდღიანი ცვლები შენთან ახლოს. უფასოა, ანაზღაურება მეორე დღეს.',
  'onb.hire': 'მჭირდება თანამშრომლები',
  'onb.hireSub': 'დაამატე ცვლა და მიიღე გადამოწმებული მუშაკები. თუ ვინმე არ მოვა, შემცვლელს ვიპოვით.',
  'onb.fullName': 'სახელი და გვარი',
  'onb.skills': 'რა სამუშაოს შეასრულებ?',
  'onb.areas': 'უბნები, სადაც შეგიძლია მუშაობა',
  'onb.areasPh': 'ვაკე, საბურთალო, ძველი თბილისი',
  'onb.languages': 'ენები',
  'onb.languagesPh': 'ქართული, ინგლისური, რუსული',
  'onb.verify': 'ვინაობის დადასტურება',
  'onb.verifySub': 'დამსაქმებლები მხოლოდ გადამოწმებულ მუშაკებს ხედავენ. ფოტოები კონფიდენციალურია და მხოლოდ ჩვენი გუნდი ნახავს.',
  'onb.idPhoto': 'პირადობის ფოტო',
  'onb.idDone': 'პირადობის ფოტო ✓',
  'onb.selfie': 'სელფის გადაღება',
  'onb.selfieDone': 'სელფი ✓',
  'onb.business': 'ბიზნესის სახელი',
  'onb.legalId': 'საიდენტიფიკაციო კოდი (არასავალდებულო)',
  'onb.terms': 'გაგრძელებით ეთანხმები წესებს, მათ შორის იმას, რომ აქ გაცნობილ ადამიანებთან ყველა ცვლას აპლიკაციით შეათანხმებ.',
  'onb.create': 'პროფილის შექმნა',

  'feed.idPending': 'შენს პირადობას ვამოწმებთ',
  'feed.idPendingSub': 'ცვლების დათვალიერება უკვე შეგიძლია, აღებას კი გადამოწმების შემდეგ შეძლებ, როგორც წესი, ერთ დღეში.',
  'feed.suspended': 'შენი ანგარიში შეჩერებულია',
  'feed.suspendedSub': 'ეს ხდება 3 გაფრთხილების შემდეგ (გამოუცხადებლობა ან გვიანი გაუქმება). გასაჩივრებლად დაგვიკავშირდი.',
  'feed.setupPayouts': 'დაამატე საბანკო ანგარიში',
  'feed.setupPayoutsSub': 'დაამატე IBAN, რომ ყოველი ცვლის შემდეგ ანაზღაურება მიიღო.',
  'feed.empty': 'ახლა ღია ცვლები არ არის. განსაახლებლად ჩამოწიე.',

  'my.empty': 'მომავალი ცვლები არ გაქვს. იპოვე ცვლების სიაში.',
  'earn.paidOut': 'ჩარიცხული',
  'earn.onTheWay': 'გზაშია',
  'earn.explain':
    'ანაზღაურება საბანკო ანგარიშზე შემდეგ სამუშაო დღეს ჩაირიცხება, მას შემდეგ რაც დამსაქმებელი საათებს დაადასტურებს. თუ არ დაადასტურებს, საათები ავტომატურად დადასტურდება წასვლიდან 24 საათში.',
  'earn.paid': 'ჩარიცხულია',
  'earn.lateCancel': ' · გვიანი გაუქმების კომპენსაცია',
  'earn.empty': 'შემოსავალი აქ პირველი ცვლის შემდეგ გამოჩნდება.',

  'shift.gone': 'ეს ცვლა აღარ არის ხელმისაწვდომი.',
  'shift.youEarn': 'გამოიმუშავებ',
  'shift.payExplain': '{rate}/სთ × {hours} სთ. ჩაგერიცხება ცვლის შემდეგ. საკომისიო შენთვის არ არის.',
  'shift.addressLater': 'ზუსტი მისამართი და ინსტრუქცია დაჯავშნის შემდეგ გამოჩნდება.',
  'shift.viewBooking': 'ჯავშნის ნახვა',
  'shift.claim': 'ცვლის აღება',
  'shift.claimTitle': 'აიღებ ამ ცვლას?',
  'shift.claimBody': 'დაწყებამდე 24 საათზე ნაკლებით ადრე გაუქმება გაფრთხილებად ჩაითვლება. 3 გაფრთხილება ანგარიშს აჩერებს.',
  'shift.blockedSuspended': 'შენი ანგარიში შეჩერებულია.',
  'shift.blockedId': 'ცვლებს პირადობის გადამოწმების შემდეგ აიღებ.',

  'emp.booked': 'დაჯავშნილია {n}/{total}',
  'emp.whoComing': 'ვინ მოდის',
  'emp.nobody': 'ჯერ არავის დაუჯავშნია. შეგატყობინებთ, როგორც კი ვინმე დაჯავშნის.',
  'emp.workedBefore': ' · უკვე უმუშავია შენთან',
  'emp.charged': 'ჩამოიჭრა {total} (ხელფასი {wage} + საკომისიო {fee})',
  'emp.favorite': '☆ რჩეული',
  'emp.favorited': '★ რჩეული',
  'emp.cancelWorker': 'გააუქმებ {name}-ს ჯავშანს?',
  'emp.cancelLate': 'ცვლა 24 საათში იწყება, ამიტომ მუშაკი ხელფასის ნახევარს მაინც მიიღებს.',
  'emp.cancelEarly': 'თანხა სრულად დაგიბრუნდება.',
  'emp.cancelShift': 'ცვლის გაუქმება',
  'emp.cancelShiftTitle': 'გააუქმებ ამ ცვლას?',
  'emp.cancelShiftBody': 'ცვლა სიიდან წაიშლება.',
  'emp.hoursWorked': 'ნამუშევარი საათები',
  'emp.hoursHint': 'მოსვლისა და წასვლის მიხედვით. თუ წასვლიდან 24 საათში არ დაადასტურებ, საათები ავტომატურად დადასტურდება.',
  'emp.confirmHours': 'საათების დადასტურება',
  'emp.postShift': 'ცვლის დამატება',
  'emp.noUpcoming': 'მომავალი ცვლები არ გაქვს.',

  'fav.explain': 'რჩეული მუშაკები ახალ ცვლებს პირველები ხედავენ, და მათთან განმეორებით მუშაობისას საკომისიო ნაკლებია.',
  'fav.remove': 'წაშლა',
  'fav.empty': 'ცვლის შემდეგ მუშაკზე დააჭირე „რჩეულს“ და აქ გამოჩნდება.',
  'fav.rebook': 'ხელახლა დაჯავშნა: ცვლა რჩეულებისთვის',

  'post.cardFirst': 'ჯერ დაამატე საბანკო ბარათი',
  'post.cardFirstSub':
    'თანხა მხოლოდ მაშინ ჩამოგეჭრება, როცა მუშაკი ცვლას დაჯავშნის. თანხა ცვლის დასრულებამდე ინახება და დაგიბრუნდება, თუ არავინ მოვა.',
  'post.addCard': 'ბარათის დამატება',
  'post.type': 'სამუშაოს ტიპი',
  'post.title': 'სამუშაოს დასახელება (არასავალდებულო)',
  'post.titlePh': 'მაგ. მიმტანი ქორწილზე',
  'post.date': 'თარიღი',
  'post.start': 'დაწყება',
  'post.end': 'დასრულება',
  'post.workers': 'მუშაკების რაოდენობა',
  'post.rate': 'საათობრივი ანაზღაურება (₾)',
  'post.area': 'უბანი (ყველა ხედავს)',
  'post.areaPh': 'მაგ. ვაკე',
  'post.address': 'ზუსტი მისამართი',
  'post.addressPh': 'ქუჩა, ნომერი',
  'post.addressHint': 'მუშაკები მხოლოდ დაჯავშნის შემდეგ ნახავენ.',
  'post.useLocation': 'ჩემი ამჟამინდელი ლოკაცია',
  'post.pinned': 'ადგილი მონიშნულია ✓',
  'post.description': 'რას მოიცავს სამუშაო',
  'post.instructions': 'ინსტრუქცია დაჯავშნილი მუშაკებისთვის',
  'post.instructionsPh': 'ჩაცმის წესი, ვის მიმართონ, შესასვლელი',
  'post.favoritesFirst': 'ჯერ ჩემს რჩეულ მუშაკებს შევთავაზო ({hours} საათით ადრე)',
  'post.total': 'ჯამური ფასი',
  'post.breakdown': 'ხელფასი {wage} + მომსახურების საკომისიო {fee} ({pct}%)',
  'post.repeatNote': 'განმეორებითი და რჩეული მუშაკებისთვის საკომისიო {repeat}%-ია {first}%-ის ნაცვლად, ამიტომ საბოლოო ფასი შეიძლება ნაკლები იყოს.',
  'post.urgentNote': 'მოიცავს {pct}%-იან დანამატს სასწრაფო ცვლებზე, რომლებიც 24 საათში იწყება.',
  'post.enterDetails': 'ფასის სანახავად შეიყვანე თარიღი, დრო და ანაზღაურება.',
  'post.submit': 'ცვლის გამოქვეყნება',
  'post.locationNeeded': 'ადგილის მოსანიშნად ლოკაციაზე წვდომა გვჭირდება.',
  'post.addressNotFound': 'მისამართი ვერ ვიპოვეთ. სცადე „ჩემი ამჟამინდელი ლოკაცია“ სამუშაო ადგილზე.',

  'book.openMaps': 'რუკაზე გახსნა',
  'book.arrive': 'როცა მიხვალ',
  'book.arriveSub': 'მონიშნე მოსვლა სამუშაო ადგილზე. ეს შესაძლებელია დაწყებამდე 30 წუთით ადრე და იყენებს შენს ლოკაციას.',
  'book.checkIn': 'მოვედი',
  'book.checkedInAt': 'მოსვლა მოინიშნა {time}-ზე.',
  'book.checkOut': 'მივდივარ',
  'book.checkOutTitle': 'ასრულებ ცვლას?',
  'book.checkOutBody': 'საათები ახლანდელ დრომდე დაითვლება.',
  'book.checkedOut':
    'წასვლა მოინიშნა {time}-ზე. დამსაქმებელს 24 საათი აქვს საათების დასადასტურებლად, შემდეგ ისინი ავტომატურად დადასტურდება და თანხა ჩაგერიცხება.',
  'book.message': 'მიწერე დამსაქმებელს',
  'book.cancel': 'ცვლის გაუქმება',
  'book.cancelTitle': 'გააუქმებ ამ ცვლას?',
  'book.cancelLate': 'ცვლა 24 საათში იწყება, ამიტომ გაუქმება გაფრთხილებად ჩაითვლება. 3 გაფრთხილება ანგარიშს აჩერებს.',
  'book.cancelEarly': 'გაუქმება უფასოა, რადგან ცვლამდე 24 საათზე მეტია.',
  'book.locationNeeded': 'მოსვლის მოსანიშნად ლოკაციაზე წვდომა გვჭირდება.',
  'book.theEmployer': 'დამსაქმებელი',

  'chat.safety': 'შენი უსაფრთხოებისთვის ტელეფონის ნომრები და სხვა საკონტაქტო ინფორმაცია დამალულია. ჩატი ანაზღაურების შემდეგ დაიხურება.',
  'chat.placeholder': 'შეტყობინება',
  'chat.send': 'გაგზავნა',
  'chat.hidden': ' · საკონტაქტო ინფორმაცია დამალულია',
  'chat.warnTitle': 'საკონტაქტო ინფორმაცია დაიმალება',
  'chat.warnBody':
    'ჩატში ტელეფონის ნომრები, ელფოსტა და სოციალური ქსელები იმალება. ყველაფერი აპლიკაციაში შეათანხმე: ასე არის ანაზღაურება გარანტირებული და გამოუცხადებელი მუშაკი ჩანაცვლებული. მაინც გაგზავნი?',

  'rate.title': 'შეაფასე {name}',
  'rate.comment': 'კომენტარი (არასავალდებულო)',
  'rate.submit': 'შეფასების გაგზავნა',

  'prof.idVerified': 'პირადობა დადასტურებულია',
  'prof.idPending': 'პირადობა მოწმდება',
  'prof.idRejected': 'პირადობა უარყოფილია',
  'prof.strikes': 'გაფრთხილება {n}/3',
  'prof.areas': 'უბნები: {list}',
  'prof.languages': 'ენები: {list}',
  'prof.privacyWorker': 'შენს ტელეფონის ნომერს დამსაქმებლები ვერ ხედავენ. მიმოწერა აპლიკაციით ხდება.',
  'prof.privacyEmployer': 'შენს ტელეფონის ნომერს მუშაკები ვერ ხედავენ. მიმოწერა აპლიკაციით ხდება.',
  'prof.edit': 'პროფილის რედაქტირება',
  'prof.payoutsSet': 'საბანკო ანგარიში: დამატებულია',
  'prof.payoutsAdd': 'დაამატე საბანკო ანგარიში',
  'prof.cardSaved': 'საბანკო ბარათი: შენახულია',
  'prof.cardAdd': 'დაამატე საბანკო ბარათი',
  'prof.language': 'ენა: ქართული',
  'prof.signOut': 'გასვლა',
  'edit.fullName': 'სახელი და გვარი',
  'edit.about': 'შენს შესახებ',
  'edit.aboutHint': 'არ მიუთითო ტელეფონის ნომერი ან სოციალური ქსელები.',
  'edit.skills': 'უნარები',
  'edit.areas': 'უბნები',

  'pay.cardSaved': 'ბარათი შენახულია {mask}',
  'pay.addCard': 'დაამატე საბანკო ბარათი',
  'pay.cardExplain':
    'როცა მუშაკი ცვლას დაჯავშნის, ჩამოგეჭრება ხელფასი და ჩვენი საკომისიო, და თანხა ცვლის დასრულებამდე ინახება. თუ მუშაკი არ მოვა, თანხა დაგიბრუნდება და შემცვლელს მოვძებნით.',
  'pay.replaceCard': 'ბარათის შეცვლა',
  'pay.addCardButton': 'ბარათის დამატება',
  'pay.cardPending': 'თუ ბარათის დამატება დაასრულე, რამდენიმე წამში აქ გამოჩნდება.',
  'pay.payoutsSet': 'საბანკო ანგარიში დამატებულია',
  'pay.payoutsAsk': 'სად ჩაგირიცხოთ ანაზღაურება?',
  'pay.payoutsExplain':
    'დამსაქმებლები წინასწარ იხდიან, ამიტომ ანაზღაურება გარანტირებულია. საათების დადასტურებიდან შემდეგ სამუშაო დღეს ჩაგერიცხება. შენი ხელფასიდან არაფერს ვიკავებთ.',
  'pay.iban': 'შენი საბანკო ანგარიში (IBAN)',
  'pay.ibanHint': 'მოძებნე შენი ბანკის აპლიკაციაში (TBC, საქართველოს ბანკი, ლიბერთი…). ანგარიში შენს სახელზე უნდა იყოს.',
  'pay.ibanInvalid': 'ეს ჯერ ქართულ IBAN-ს არ ჰგავს.',
  'pay.saved': 'შენახულია.',
};

// Server error messages (from database functions and edge functions) shown in Georgian.
const SERVER_ERRORS_KA: [RegExp, string | ((m: RegExpMatchArray) => string)][] = [
  [/shift is full/i, 'ცვლა უკვე შევსებულია.'],
  [/shift is not open/i, 'ეს ცვლა აღარ არის ღია.'],
  [/already have a shift at that time/i, 'ამ დროს უკვე გაქვს სხვა ცვლა.'],
  [/already claimed this shift/i, 'ეს ცვლა უკვე აღებული გაქვს.'],
  [/reserved for favorite workers/i, 'ეს ცვლა ჯერჯერობით მხოლოდ რჩეული მუშაკებისთვისაა.'],
  [/ID verification pending/i, 'ცვლებს პირადობის გადამოწმების შემდეგ აიღებ.'],
  [/account suspended/i, 'შენი ანგარიში შეჩერებულია.'],
  [/check-in opens 30 minutes/i, 'მოსვლის მონიშვნა ცვლის დაწყებამდე 30 წუთით ადრე გაიხსნება.'],
  [/shift has ended/i, 'ცვლა დასრულდა.'],
  [/you are (\d+) m from the job site/i, (m) => `სამუშაო ადგილიდან ${m[1]} მეტრში ხარ. მონიშნე, როცა მიხვალ.`],
  [/payment didn't go through/i, 'დამსაქმებლის გადახდა ვერ შესრულდა, ამიტომ ცვლის დაჯავშნა ახლა ვერ ხერხდება.'],
  [/cancel the booked workers first/i, 'ჯერ დაჯავშნილი მუშაკების ჯავშნები გააუქმე.'],
  [/rate after the shift/i, 'შეფასება ცვლის შემდეგ შეგიძლია.'],
  [/chat is closed/i, 'ამ ჯავშნის ჩატი დახურულია.'],
  [/only upcoming bookings can be cancelled/i, 'მხოლოდ მომავალი ჯავშნის გაუქმებაა შესაძლებელი.'],
  [/no_contact_info|check constraint/i, 'ტექსტში არ მიუთითო ტელეფონის ნომერი, ელფოსტა ან სოციალური ქსელები.'],
];

export function translateError(lang: Lang, message: string): string {
  if (lang === 'en') return message;
  for (const [pattern, text] of SERVER_ERRORS_KA) {
    const m = message.match(pattern);
    if (m) return typeof text === 'string' ? text : text(m);
  }
  return message;
}

export type Lang = 'ka' | 'en';
const DICTS: Record<Lang, Record<TKey, string>> = { ka, en };
const STORAGE_KEY = 'lang';

export function translate(lang: Lang, key: TKey, vars?: Record<string, string | number>): string {
  const text = DICTS[lang][key] ?? en[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m)) : text;
}

type I18n = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
};

function initialLang(): Lang {
  // Georgian by default for the Tbilisi launch; English only if the phone is set to English.
  const code = getLocales()[0]?.languageCode;
  return code === 'en' ? 'en' : 'ka';
}

const I18nContext = createContext<I18n>({
  lang: 'ka',
  setLang: () => {},
  t: (key, vars) => translate('ka', key, vars),
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'ka' || saved === 'en') setLangState(saved);
      })
      .catch(() => {});
  }, []);

  setFormatLocale(lang);
  setConfirmLabels({ yes: translate(lang, 'common.yes'), no: translate(lang, 'common.no') });

  const setLang = (next: Lang) => {
    setLangState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t: (key, vars) => translate(lang, key, vars) }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT(): I18n {
  return useContext(I18nContext);
}
