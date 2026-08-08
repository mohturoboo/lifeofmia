import type { Locale } from '@/i18n/config';
import { fromDateKey, type DateKey } from '@/lib/date';

/**
 * Citation du jour.
 *
 * Le choix est deterministe : il depend de la date et de l'identifiant de
 * l'utilisateur. Deux consequences utiles — la citation ne change pas si la
 * page est rechargee, et deux utilisateurs ne voient pas la meme le meme jour.
 */

interface Quote {
  author: string;
  text: Record<Locale, string>;
}

const QUOTES: Quote[] = [
  {
    author: 'Aristote',
    text: {
      fr: "Nous sommes ce que nous faisons de maniere repetee. L'excellence n'est donc pas un acte, mais une habitude.",
      en: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.',
      ar: 'نحن ما نفعله بشكل متكرر. لذا فإن التميز ليس فعلاً بل عادة.',
      es: 'Somos lo que hacemos repetidamente. La excelencia no es un acto, sino un habito.',
      de: 'Wir sind, was wir wiederholt tun. Exzellenz ist daher keine Tat, sondern eine Gewohnheit.',
      it: 'Siamo cio che facciamo ripetutamente. L\'eccellenza non e un atto, ma un\'abitudine.',
      pt: 'Somos o que fazemos repetidamente. A excelencia nao e um ato, mas um habito.',
      tr: 'Biz tekrar tekrar yaptigimiz seyleriz. O halde mukemmellik bir eylem degil, bir aliskanliktir.',
    },
  },
  {
    author: 'Lao Tseu',
    text: {
      fr: 'Un voyage de mille lieues commence toujours par un premier pas.',
      en: 'A journey of a thousand miles begins with a single step.',
      ar: 'رحلة الألف ميل تبدأ بخطوة واحدة.',
      es: 'Un viaje de mil millas comienza con un solo paso.',
      de: 'Eine Reise von tausend Meilen beginnt mit einem einzigen Schritt.',
      it: 'Un viaggio di mille miglia inizia con un solo passo.',
      pt: 'Uma jornada de mil milhas comeca com um unico passo.',
      tr: 'Bin millik bir yolculuk tek bir adimla baslar.',
    },
  },
  {
    author: 'Seneque',
    text: {
      fr: "Ce n'est pas parce que les choses sont difficiles que nous n'osons pas, c'est parce que nous n'osons pas qu'elles sont difficiles.",
      en: 'It is not because things are difficult that we do not dare; it is because we do not dare that they are difficult.',
      ar: 'ليس لأن الأمور صعبة لا نجرؤ، بل لأننا لا نجرؤ تكون صعبة.',
      es: 'No nos atrevemos a muchas cosas porque son dificiles, pero son dificiles porque no nos atrevemos.',
      de: 'Nicht weil es schwer ist, wagen wir es nicht, sondern weil wir es nicht wagen, ist es schwer.',
      it: 'Non e perche le cose sono difficili che non osiamo, e perche non osiamo che sono difficili.',
      pt: 'Nao e porque as coisas sao dificeis que nao ousamos; e porque nao ousamos que elas sao dificeis.',
      tr: 'Zor oldugu icin cesaret edemiyoruz degil; cesaret edemedigimiz icin zor.',
    },
  },
  {
    author: 'James Clear',
    text: {
      fr: "Vous ne vous elevez pas au niveau de vos objectifs, vous retombez au niveau de vos systemes.",
      en: 'You do not rise to the level of your goals. You fall to the level of your systems.',
      ar: 'أنت لا ترتقي إلى مستوى أهدافك، بل تسقط إلى مستوى أنظمتك.',
      es: 'No te elevas al nivel de tus metas, caes al nivel de tus sistemas.',
      de: 'Du steigst nicht auf das Niveau deiner Ziele, du fallst auf das Niveau deiner Systeme.',
      it: 'Non sali al livello dei tuoi obiettivi, scendi al livello dei tuoi sistemi.',
      pt: 'Voce nao se eleva ao nivel dos seus objetivos, voce cai ao nivel dos seus sistemas.',
      tr: 'Hedeflerinizin seviyesine yukselmezsiniz, sistemlerinizin seviyesine dusersiniz.',
    },
  },
  {
    author: 'Marc Aurele',
    text: {
      fr: 'La qualite de votre vie depend de la qualite de vos pensees.',
      en: 'The quality of your life depends on the quality of your thoughts.',
      ar: 'جودة حياتك تعتمد على جودة أفكارك.',
      es: 'La calidad de tu vida depende de la calidad de tus pensamientos.',
      de: 'Die Qualitat deines Lebens hangt von der Qualitat deiner Gedanken ab.',
      it: 'La qualita della tua vita dipende dalla qualita dei tuoi pensieri.',
      pt: 'A qualidade da sua vida depende da qualidade dos seus pensamentos.',
      tr: 'Hayatinizin kalitesi dusuncelerinizin kalitesine baglidir.',
    },
  },
  {
    author: 'Confucius',
    text: {
      fr: "Peu importe la lenteur a laquelle vous avancez, tant que vous ne vous arretez pas.",
      en: 'It does not matter how slowly you go, as long as you do not stop.',
      ar: 'لا يهم مدى بطء تقدمك، طالما أنك لا تتوقف.',
      es: 'No importa lo lento que vayas, mientras no te detengas.',
      de: 'Es spielt keine Rolle, wie langsam du gehst, solange du nicht stehen bleibst.',
      it: 'Non importa quanto lentamente vai, purche tu non ti fermi.',
      pt: 'Nao importa o quao devagar voce va, desde que nao pare.',
      tr: 'Ne kadar yavas gittiginiz onemli degil, yeter ki durmayin.',
    },
  },
  {
    author: 'Will Durant',
    text: {
      fr: "La discipline est le pont entre les objectifs et les accomplissements.",
      en: 'Discipline is the bridge between goals and accomplishment.',
      ar: 'الانضباط هو الجسر بين الأهداف والإنجاز.',
      es: 'La disciplina es el puente entre las metas y los logros.',
      de: 'Disziplin ist die Brucke zwischen Zielen und Erfolg.',
      it: 'La disciplina e il ponte tra gli obiettivi e i risultati.',
      pt: 'A disciplina e a ponte entre objetivos e realizacoes.',
      tr: 'Disiplin, hedefler ile basari arasindaki kopurdur.',
    },
  },
  {
    author: 'Antoine de Saint-Exupery',
    text: {
      fr: "Un objectif sans plan n'est qu'un souhait.",
      en: 'A goal without a plan is just a wish.',
      ar: 'الهدف بلا خطة مجرد أمنية.',
      es: 'Una meta sin un plan es solo un deseo.',
      de: 'Ein Ziel ohne Plan ist nur ein Wunsch.',
      it: 'Un obiettivo senza un piano e solo un desiderio.',
      pt: 'Um objetivo sem um plano e apenas um desejo.',
      tr: 'Plani olmayan bir hedef sadece bir dilektir.',
    },
  },
  {
    author: 'Proverbe',
    text: {
      fr: "Le meilleur moment pour planter un arbre etait il y a vingt ans. Le deuxieme meilleur moment, c'est maintenant.",
      en: 'The best time to plant a tree was twenty years ago. The second best time is now.',
      ar: 'أفضل وقت لزراعة شجرة كان قبل عشرين عاماً. وثاني أفضل وقت هو الآن.',
      es: 'El mejor momento para plantar un arbol fue hace veinte anos. El segundo mejor momento es ahora.',
      de: 'Die beste Zeit, einen Baum zu pflanzen, war vor zwanzig Jahren. Die zweitbeste ist jetzt.',
      it: 'Il momento migliore per piantare un albero era vent\'anni fa. Il secondo momento migliore e adesso.',
      pt: 'O melhor momento para plantar uma arvore foi ha vinte anos. O segundo melhor momento e agora.',
      tr: 'Bir agac dikmek icin en iyi zaman yirmi yil onceydi. Ikinci en iyi zaman ise simdi.',
    },
  },
  {
    author: 'Jim Rohn',
    text: {
      fr: 'Prenez soin de votre corps. C\'est le seul endroit ou vous etes oblige de vivre.',
      en: 'Take care of your body. It is the only place you have to live.',
      ar: 'اعتنِ بجسدك، فهو المكان الوحيد الذي تعيش فيه.',
      es: 'Cuida tu cuerpo. Es el unico lugar donde tienes que vivir.',
      de: 'Kummere dich um deinen Korper. Er ist der einzige Ort, an dem du leben musst.',
      it: 'Prenditi cura del tuo corpo. E l\'unico posto in cui devi vivere.',
      pt: 'Cuide do seu corpo. E o unico lugar onde voce tem de viver.',
      tr: 'Bedeninize iyi bakin. Yasamak zorunda oldugunuz tek yer orasi.',
    },
  },
  {
    author: 'Peter Drucker',
    text: {
      fr: 'Ce qui se mesure s\'ameliore.',
      en: 'What gets measured gets improved.',
      ar: 'ما يُقاس يتحسن.',
      es: 'Lo que se mide, mejora.',
      de: 'Was gemessen wird, wird verbessert.',
      it: 'Cio che viene misurato viene migliorato.',
      pt: 'O que e medido e melhorado.',
      tr: 'Olculen sey gelisir.',
    },
  },
  {
    author: 'Nelson Mandela',
    text: {
      fr: 'Cela semble toujours impossible, jusqu\'a ce qu\'on le fasse.',
      en: 'It always seems impossible until it is done.',
      ar: 'يبدو الأمر مستحيلاً دائماً حتى يتم إنجازه.',
      es: 'Siempre parece imposible hasta que se hace.',
      de: 'Es scheint immer unmoglich, bis es getan ist.',
      it: 'Sembra sempre impossibile finche non viene fatto.',
      pt: 'Parece sempre impossivel ate que seja feito.',
      tr: 'Yapilana kadar her sey imkansiz gorunur.',
    },
  },
];

/** Hachage stable (FNV-1a) : meme entree, meme sortie, sans dependance. */
function hash(input: string): number {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value);
}

export function quoteOfTheDay(
  date: DateKey,
  locale: Locale,
  userId = '',
): { text: string; author: string } {
  const dayNumber = Math.floor(fromDateKey(date).getTime() / 86_400_000);
  const index = (dayNumber + hash(userId)) % QUOTES.length;
  const quote = QUOTES[index];
  return { text: quote.text[locale] ?? quote.text.en, author: quote.author };
}

export const quoteCount = QUOTES.length;
