const puppeteer = require('puppeteer');
const moment = require('moment');
const credentials = require('../credentials/senac-blackboard.json');

async function robot () {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true,
    });
    
    try {
        console.log(`> [senac-robot] Login senac`);
        const page = await singIn();
        console.log(`> [senac-robot] Navigate to blackboard`);
        await navigateToBlackboard(page);
        console.log(`> [senac-robot] Get list graduate`);
        const universityGraduate = await getLinkUniversityGraduate(page);
        const tasks = [];

        let index = 0;
        for (const graduate of universityGraduate) {
            console.log(`> [senac-robot] [${index+1}/${universityGraduate.length}] Seaching tasks - ${graduate.name}`);

            await page.goto(graduate.link);
            const gradroNotas = await searchInQuadroNotas(page);
            await page.goto(graduate.link);
            const aulas = await searchInAulas(page);
            await page.goto(graduate.link);
            const testes = await searchInTestes(page);

            const innerTasks = [...gradroNotas, ...aulas, ...testes];

            if (innerTasks && innerTasks.length > 0) {
                tasks.push({
                    name: graduate.name,
                    innerTasks 
                });
            }

            console.log(`> [senac-robot] Found ${gradroNotas.length} tasks`);
            index++;
        }

        return tasks;
    }
    catch(e) {
        throw e;
    }
    finally {
        await browser.close();
    }

    async function singIn() {
        const page = await browser.newPage();
        await page.goto("https://www.sp.senac.br/login/Login");

        await page.type('[name="email"]', credentials.user);
        await page.type('[name="senha"]', credentials.password);

        await page.click('#formLoginButtonSubmit');
        await page.waitFor(3000);
        return page;
    }

    async function navigateToBlackboard(page) {
        await page.goto("https://www.sp.senac.br/login-unico/SSOBlackBoard9");
    }

    async function getLinkUniversityGraduate(page) {
        const universityGraduate = [];
        const xPathBoxGraduate = '//*[@id="module:_913_1"]/div[2]/div';
        const elementBox = await page.$x(xPathBoxGraduate);

        if (elementBox.length === 0) throw new Error("Você não está inscrito em nenhuma graduação");

        const links = await elementBox[0].$$('a');

        for (const element of links) {
            const link = await getUrlLink(element);
            if (link) {
                const name = await getTextElement(page, element);
                if (name.indexOf(credentials.codeCourse) > -1) {
                    universityGraduate.push({
                        name,
                        link
                    });
                }
            }
        }
        return universityGraduate;
    }

    function getText(linkText) {
        linkText = linkText.replace(/\r\n|\r/g, "\n");
        linkText = linkText.replace(/\ +/g, " ");
      
        // Replace &nbsp; with a space 
        var nbspPattern = new RegExp(String.fromCharCode(160), "g");
        return linkText.replace(nbspPattern, " ");
    }

    async function findByLink(page, linkString) {
        const links = await page.$$('a')
        for (var i=0; i < links.length; i++) {
          let valueHandle = await links[i].getProperty('innerText');
          let linkText = await valueHandle.jsonValue();
          const text = getText(linkText);
          if (linkString === text) {
            return links[i];
          }
        }
        return null;
    }

    async function getUrlLink(element) {
        let link = '';
        const hrefHandle = await element.getProperty('href');
        link = await hrefHandle.jsonValue();
        return link;
    }

    async function getTextElement(page, element) {
        return await page.evaluate(element => element.textContent, element);
    }

    async function getDueTask(page, cell) {
        let vencimento = null;
        const element = await cell.$('.activityType');
        if (element) {
            const textElement = await getTextElement(page, element);
            const index = textElement.indexOf(':');
            if (index > -1) {
                const dtVencimento = textElement.substr(index + 1);
                vencimento = moment(dtVencimento.trim(), 'DD/MM/YYYY');
            }
        }
        return vencimento;
    }

    async function getTextTask(page, cell) {
        let value = '';
        const textElement = await getTextElement(page, cell);
        if (textElement) {
            const index = textElement.indexOf('V');
            if (index > -1) {
                const text = textElement.substr(0, index);
                value = text.trim();
            }
        }
        return value;
    }

    async function searchInTestes(page) {
        const tasks = [];
        const tabName = 'Testes';
        const element = await findByLink(page, tabName);

        if (element) {
            const url = await getUrlLink(element);
            await page.goto(url);

            const elementLink = await page.$$('a');

            for (const item of elementLink) {
                const url = await getUrlLink(item);
                const text = await getTextElement(item);

                if (url && url.indexOf('launchAssessment.jsp') > -1) {
                    tasks.push({
                        title: text
                    });
                }
            }
        }

        return tasks;
    }

    async function searchInAulas(page) {
        const tasks = [];
        const tabName = 'Aulas';
        const classItem = '.liItem.read';
        const element = await findByLink(page, tabName);

        if (element) {
            const url = await getUrlLink(element);
            await page.goto(url);

            const itens = await page.$$(classItem);
            const itensLink = [];

            // Get links from 'Aulas'
            for (const item of itens) {
                const elementLink = await item.$('a');
                if (elementLink) {
                    const url = await getUrlLink(elementLink);
                    if (url && url.indexOf('listContent.jsp') > -1) {
                        itensLink.push(url);
                    }
                }
            }

            for (const url of itensLink) {

                await page.goto(url);

                const itensInner = await page.$$(classItem);
                for (const item of itensInner) {
                    const elementLink = await item.$('a');
                    if (elementLink) {
                        const url = await getUrlLink(elementLink);
                        const text = await getTextElement(elementLink);

                        if (url.indexOf('classroom.github.com') > -1) {
                            tasks.push({
                                title: text,
                                notes: `Url - ${url}`
                            });
                        }
                    }
                }
            }
        }
        return tasks;
    }

    async function searchInQuadroNotas(page) {
        const tasks = [];
        const tabName = 'Quadro de Notas';
        const element = await findByLink(page, tabName);

        if (element) {
            const url = await getUrlLink(element);
            await page.goto(url);

            const itens = await page.$$('.sortable_item_row .cell.gradable');

            for (const item of itens) {
                const text = await getTextTask(page, item);
                const dtVencimento = await getDueTask(page, item);

                if (text && dtVencimento && dtVencimento.isValid() && dtVencimento.isAfter(new Date())) {
                    tasks.push({
                        title: text,
                        due: dtVencimento.toISOString()
                    });
                }
            }
        } else {
            console.info(`Tab ${tabName} não encontrado.`);
        }        

        return tasks;
    }
}


module.exports = robot;